import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CardService } from './card.service';
import { CreateCardBeneficiaryDto } from './dto/addCard.dto';
import { CardBeneFiciaryDocument } from './interface/addCard.interface';

@Controller('card')
export class CardController {

    constructor(private readonly createCardBeneficiaryService: CardService) { }

    // @Post()
    // async create(@Body() createCardBeneficiaryDto: CreateCardBeneficiaryDto): Promise<CardBeneFiciaryDocument> {
    //     return this.createCardBeneficiaryService.create(createCardBeneficiaryDto);
    // }

    @Post()
async create(@Body() createCardBeneficiaryDto: CreateCardBeneficiaryDto): Promise<CardBeneFiciaryDocument> {
    return this.createCardBeneficiaryService.create(createCardBeneficiaryDto);
}




    @Get('card-list')
    async findAll(): Promise<CardBeneFiciaryDocument[]> {
        return this.createCardBeneficiaryService.getAllCardBeneficiaries();
    }

    @Get(':cardType')
    async getCardBeneficiariesByCardType(
        @Param('cardType') cardType: string,
    ): Promise<CardBeneFiciaryDocument[]> {
        return this.createCardBeneficiaryService.getCardBeneficiariesByCardType(cardType);
    }




    @Get('number/:cardNumber')
    async getCardInfoByCardNumber(@Param('cardNumber') cardNumber: number) {
        return this.createCardBeneficiaryService.findByCardNumber(cardNumber);
    }



    @Put('number/:cardNumber')
    async updateCardBeneficiary(
        @Param('cardNumber') cardNumber: number,
        @Body() updateDto: CreateCardBeneficiaryDto,
    ) {
        return this.createCardBeneficiaryService.updateCardBeneficiary(cardNumber, updateDto);
    }



    @Delete(':cardNumber')
async deleteCardBeneficiary(@Param('cardNumber') cardNumber: number): Promise<{ message: string }> {
    return this.createCardBeneficiaryService.deleteCardBeneficiary(cardNumber);
}








}
