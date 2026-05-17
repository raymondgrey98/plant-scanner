const fs   = require('fs');
const path = require('path');

const ENABLED = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY    &&
  process.env.CLOUDINARY_API_SECRET
);

let cloudinary;
if (ENABLED) {
  try {
    cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  } catch {
    console.warn('[cloudinary] Package not installed — falling back to local storage. Run: npm install cloudinary');
  }
}

async function uploadImage(localPath, folder = 'floraiq/scans') {
  if (!ENABLED || !cloudinary) return null;
  try {
    const result = await cloudinary.uploader.upload(localPath, {
      folder,
      resource_type: 'image',
      quality: 'auto',
      fetch_format: 'auto',
    });
    return result.secure_url;
  } catch (err) {
    console.error('[cloudinary] Upload failed:', err.message);
    return null;
  }
}

async function deleteImage(publicIdOrUrl) {
  if (!ENABLED || !cloudinary || !publicIdOrUrl) return;
  try {
    let publicId = publicIdOrUrl;
    if (publicIdOrUrl.startsWith('http')) {
      const parts = publicIdOrUrl.split('/');
      const filename = parts[parts.length - 1].split('.')[0];
      const folder   = parts[parts.length - 2];
      publicId = `${folder}/${filename}`;
    }
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('[cloudinary] Delete failed:', err.message);
  }
}

function deleteLocalFile(filePath) {
  if (!filePath) return;
  try { fs.unlinkSync(filePath); } catch { /* file already gone */ }
}

module.exports = { uploadImage, deleteImage, deleteLocalFile, isCloudinaryEnabled: () => ENABLED };
