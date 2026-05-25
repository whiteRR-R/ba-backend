import { v2 as cloudinary } from 'cloudinary';

let configured = false;

const ensureCloudinaryConfig = (): void => {
  if (configured) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary env vars are missing');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  configured = true;
};

export const uploadToCloudinary = async (
  filePath: string,
  mediaType: 'photo' | 'video',
  folder = 'ba-challenge/submissions'
): Promise<string> => {
  ensureCloudinaryConfig();

  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: mediaType === 'video' ? 'video' : 'image',
  });

  return result.secure_url;
};
