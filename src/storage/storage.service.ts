import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import * as cloudinary from 'cloudinary';

@Injectable()
export class StorageService {
  constructor() {
    cloudinary.v2.config({
      cloud_name: 'dyrj8qeha',
      api_key: '293269134584654',
      api_secret: 'rqIAQuCPAStJ8tRVC4mRSynyeQQ',
    });
  }

  async optimizeImage(buffer: Buffer, width = 1200) {
    try {
      return await sharp(buffer)
        .resize({
          fit: sharp.fit.contain,
          width,
        })
        .toBuffer();
    } catch (error) {
      throw new Error(`Error optimizing image: ${error.message}`);
    }
  }

  uploadFile(fileBuffer: any, folder: string) {
    return new Promise((resolve, reject) => {
      cloudinary.v2.uploader
        .upload_stream({ folder }, function (error, result) {
          // console.log({ result, error });
          if (error) reject(error);
          if (result) resolve(result);
        })
        .end(fileBuffer);
    });
  }
}
