import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AssistantFaq, AssistantFaqDocument } from './schemas/faq.schema';
import { AssistantConfig, AssistantConfigDocument } from './schemas/config.schema';
import { AssistantUnanswered, AssistantUnansweredDocument } from './schemas/unanswered.schema';
import { AssistantEvent, AssistantEventDocument } from './schemas/event.schema';
import { normalizeText, expandSynonyms } from './matching/normalize';
import { SYNONYMS } from './matching/synonyms';
import { BM25Doc, bm25Score } from './matching/bm25';
import { trigramSimilarity } from './matching/fuzzy';
import { rrf } from './matching/fusion';
import { isSensitive } from './guards/sensitive-info.guard';
import { isOrderStatusQuery } from './guards/order-status.guard';

const SENSITIVE_MSG = "I'm sorry, but I can't safely handle questions that include sensitive information like passwords, OTPs, PINs, or card details. Please ask a different question or contact us directly via WhatsApp.";
const ORDER_STATUS_MSG = "For order status updates, it's best to share your order number with us on WhatsApp so our team can check it for you directly.";
const FALLBACK_UNANSWERED = "I couldn't find a specific answer for that in our knowledge base. You can try rephrasing your question, or chat with our support team on WhatsApp for quick help.";

@Injectable()
export class AssistantService implements OnModuleInit {
  private config: AssistantConfig | null = null;

  constructor(
    @InjectModel(AssistantFaq.name) private faqModel: Model<AssistantFaqDocument>,
    @InjectModel(AssistantConfig.name) private configModel: Model<AssistantConfigDocument>,
    @InjectModel(AssistantUnanswered.name) private unansweredModel: Model<AssistantUnansweredDocument>,
    @InjectModel(AssistantEvent.name) private eventModel: Model<AssistantEventDocument>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultConfig();
  }

  async ensureDefaultConfig() {
    const count = await this.configModel.countDocuments();
    if (count === 0) {
      await this.configModel.create({} as any);
    }
    this.config = await this.configModel.findOne().lean();
  }

  async getConfig() {
    if (!this.config) this.config = await this.configModel.findOne().lean();
    return this.config;
  }

  async event(type: AssistantEvent['type']) {
    await this.eventModel.create({ type });
  }

  async bootstrap() {
    const cfg = await this.getConfig();
    const quick = [
      { label: 'Shipping & Delivery', action: 'delivery_time' },
      { label: 'Weight Charge', action: 'weight_charge' },
      { label: 'Advance Payment', action: 'advance_payment' },
      { label: 'Customs & Duty', action: 'customs' },
      { label: 'Ready Stock', action: 'ready_stock' },
      { label: 'Contact Us', action: 'contact' },
    ];
    return {
      welcome: 'Hi! How can I help you today?',
      quickActions: quick,
      contact: cfg?.contact,
      weightChargeBdtPer100g: cfg?.weightChargeBdtPer100g,
      advancePercent: cfg?.advancePercent,
      deliveryTypicalDays: cfg?.deliveryTypicalDays,
    };
  }

  private isGreetingOnly(q: string) {
    const t = normalizeText(q);
    if (!t) return true;
    const greetings = ['hi', 'hello', 'hey', 'salam', 'assalamu', 'walaikum', 'thanks', 'thank you', 'dhonyobad', 'ধন্যবাদ'];
    if (greetings.some((g) => t === g || t.startsWith(g + ' '))) return true;
    return false;
  }

  async ask(question: string) {
    const raw = question || '';
    await this.event('chatbot_question');
    if (isSensitive(raw)) {
      await this.event('chatbot_unanswered');
      return { status: 'handoff' as const, answer: SENSITIVE_MSG, handoff: { type: 'whatsapp' as const, includeQuestion: false } };
    }
    if (isOrderStatusQuery(raw)) {
      await this.event('chatbot_unanswered');
      return { status: 'handoff' as const, answer: ORDER_STATUS_MSG, handoff: { type: 'whatsapp' as const, includeQuestion: true } };
    }
    if (this.isGreetingOnly(raw)) {
      return { status: 'answered' as const, answer: 'Hi! How can I help you today?', followups: [] };
    }
    const norm = normalizeText(raw);
    let expanded = expandSynonyms(norm, SYNONYMS);
    const faqs = await this.faqModel.find({ active: true }).lean();
    const docs: BM25Doc[] = faqs.map((f) => ({
      id: f.id,
      text: [
        f.question,
        ...(f.keywords || []),
        ...(f.alternative_phrasings || []),
        ...(f.keywords_bangla || []),
        ...(f.alternative_phrasings_bangla || []),
      ].join(' '),
    }));
    const bm = bm25Score(expanded, docs).slice(0, 10);
    const fuzzyList: Array<{ id: string; score: number }> = faqs.map((f) => {
      const candidates = [f.question, ...(f.keywords || []), ...(f.alternative_phrasings || [])].join(' ');
      const s = Math.max(trigramSimilarity(norm, f.question), trigramSimilarity(expanded, candidates));
      return { id: f.id, score: s };
    }).sort((a, b) => b.score - a.score).slice(0, 10);
    const fused = rrf([bm, fuzzyList], 60).slice(0, 5);
    if (!fused.length) {
      await this.logUnanswered(raw, norm, null, 0);
      await this.event('chatbot_unanswered');
      return { status: 'handoff' as const, answer: FALLBACK_UNANSWERED, handoff: { type: 'whatsapp' as const, includeQuestion: true } };
    }
    const top = fused[0];
    const topFaq = faqs.find((f) => f.id === top.id);
    const confidence = Math.min(top.score, 1);
    if (confidence < 0.6) {
      await this.logUnanswered(raw, norm, top.id, top.score);
      await this.event('chatbot_unanswered');
      return { status: 'handoff' as const, answer: FALLBACK_UNANSWERED, handoff: { type: 'whatsapp' as const, includeQuestion: true } };
    }
    if (confidence < 0.8) {
      await this.logUnanswered(raw, norm, top.id, top.score);
      await this.event('chatbot_unanswered');
      return {
        status: 'clarify' as const,
        suggestions: topFaq?.suggested_followups || [],
        faqId: top.id,
        answer: topFaq?.answer,
        confidence,
      };
    }
    await this.event('chatbot_answered');
    return {
      status: 'answered' as const,
      faqId: top.id,
      answer: topFaq?.answer,
      followups: topFaq?.suggested_followups || [],
      confidence,
    };
  }

  private async logUnanswered(question: string, normalized: string, topCandidateId: string | null, topScore: number) {
    const existing = await this.unansweredModel.findOne({ normalized });
    if (existing) {
      existing.timesAsked = (existing.timesAsked || 1) + 1;
      existing.updated_at = new Date();
      existing.topCandidateId = topCandidateId || existing.topCandidateId;
      existing.topScore = topScore || existing.topScore;
      await existing.save();
    } else {
      await this.unansweredModel.create({
        question,
        normalized,
        topCandidateId,
        topScore,
        timesAsked: 1,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }

  async weightCharge(country: 'USA' | 'UK', grams: number) {
    const cfg = await this.getConfig();
    const rate = cfg?.weightChargeBdtPer100g?.[country];
    if (!rate) return { chargeBdt: 0, blocks: 0, rate };
    let blocks = Math.ceil((grams || 0) / 100);
    if (blocks < 1) blocks = 1;
    const chargeBdt = blocks * rate;
    return { chargeBdt, blocks, rate, grams: grams || 0 };
  }

  async getFaqs() {
    return this.faqModel.find().sort({ id: 1 }).lean();
  }

  async createFaq(data: any) {
    return this.faqModel.create(data);
  }

  async updateFaq(id: string, data: any) {
    return this.faqModel.findOneAndUpdate({ id }, { ...data, updated_at: new Date() }, { new: true });
  }

  async deleteFaq(id: string) {
    return this.faqModel.deleteOne({ id });
  }

  async setConfig(data: any) {
    const c = await this.configModel.findOneAndUpdate({}, data, { new: true, upsert: true });
    this.config = c.toObject();
    return this.config;
  }

  async unanswered(grouped = true) {
    if (!grouped) return this.unansweredModel.find().sort({ updated_at: -1 }).lean();
    return this.unansweredModel.find().sort({ timesAsked: -1, updated_at: -1 }).lean();
  }

  async stats(from?: string, to?: string) {
    const match: any = {};
    if (from || to) {
      match.created_at = {};
      if (from) match.created_at.$gte = new Date(from);
      if (to) match.created_at.$lte = new Date(to);
    }
    const [answered, unanswered, questions] = await Promise.all([
      this.eventModel.countDocuments({ type: 'chatbot_answered', ...(from || to ? match : {}) }),
      this.eventModel.countDocuments({ type: 'chatbot_unanswered', ...(from || to ? match : {}) }),
      this.eventModel.countDocuments({ type: 'chatbot_question', ...(from || to ? match : {}) }),
    ]);
    return { answered, unanswered, questions, handoffRate: questions ? unanswered / questions : 0 };
  }
}
