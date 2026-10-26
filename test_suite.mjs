import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

// Helper to create a minimal valid 1x1 JPEG Buffer
function createFakeJpegBuffer() {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x80, 0xff, 0xd9
  ]);
}

async function runTests() {
  console.log('🚀 STARTING COMPREHENSIVE WEDDING PHOTO SHARE TESTS\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // --- Test 1: Single Upload ---
  console.log('\n--- Test 1: Single Upload ---');
  try {
    const formData = new FormData();
    const jpegBlob = new Blob([createFakeJpegBuffer()], { type: 'image/jpeg' });
    formData.append('file', jpegBlob, 'test_single_photo.jpg');
    formData.append('slug', 'noel-and-danica');
    formData.append('uploaderName', 'TestGuest');

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    assert(res.ok && data.success && data.photo?.id, 'Single photo upload succeeded with valid photo ID');
  } catch (e) {
    assert(false, `Single upload failed: ${e.message}`);
  }

  // --- Test 2: 10 Photos at Once ---
  console.log('\n--- Test 2: 10 Photos at Once ---');
  try {
    const uploadPromises = Array.from({ length: 10 }).map(async (_, i) => {
      const formData = new FormData();
      const jpegBlob = new Blob([createFakeJpegBuffer()], { type: 'image/jpeg' });
      formData.append('file', jpegBlob, `batch_photo_${i + 1}.jpg`);
      formData.append('slug', 'noel-and-danica');
      formData.append('uploaderName', `BatchUploader_${i + 1}`);

      const res = await fetch(`${BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      return res.json();
    });

    const results = await Promise.all(uploadPromises);
    const allSuccessful = results.every((r) => r.success === true);
    assert(allSuccessful, '10 photos uploaded concurrently in parallel all returned success');
  } catch (e) {
    assert(false, `10 batch upload failed: ${e.message}`);
  }

  // --- Test 3: HEIC Upload ---
  console.log('\n--- Test 3: HEIC Upload ---');
  try {
    const formData = new FormData();
    // HEIC payload simulation with proper mime & extension
    const heicBlob = new Blob([createFakeJpegBuffer()], { type: 'image/heic' });
    formData.append('file', heicBlob, 'iphone_capture.heic');
    formData.append('slug', 'noel-and-danica');
    formData.append('uploaderName', 'IphoneUser');

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    assert(res.ok && data.success, 'HEIC format accepted and successfully uploaded');
  } catch (e) {
    assert(false, `HEIC upload failed: ${e.message}`);
  }

  // --- Test 4: Rejected Video & PDF Upload ---
  console.log('\n--- Test 4: Rejected Video / PDF Upload ---');
  try {
    // 4a: Video
    const videoFormData = new FormData();
    const videoBlob = new Blob(['FAKE_VIDEO_CONTENT'], { type: 'video/mp4' });
    videoFormData.append('file', videoBlob, 'wedding_video.mp4');
    videoFormData.append('slug', 'noel-and-danica');

    const videoRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: videoFormData,
    });
    const videoData = await videoRes.json();
    assert(videoRes.status === 400 && !videoData.success, 'Rejected .mp4 video upload with 400 status');

    // 4b: PDF
    const pdfFormData = new FormData();
    const pdfBlob = new Blob(['%PDF-1.4 fake content'], { type: 'application/pdf' });
    pdfFormData.append('file', pdfBlob, 'document.pdf');
    pdfFormData.append('slug', 'noel-and-danica');

    const pdfRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: pdfFormData,
    });
    const pdfData = await pdfRes.json();
    assert(pdfRes.status === 400 && !pdfData.success, 'Rejected .pdf document upload with 400 status');
  } catch (e) {
    assert(false, `Rejection test error: ${e.message}`);
  }

  // --- Test 5: Access Code Protection ---
  console.log('\n--- Test 5: Access Code Protection ---');
  try {
    // Perform admin login first to create protected event
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin' }),
    });
    const cookieHeader = loginRes.headers.get('set-cookie');
    assert(loginRes.ok, 'Admin login succeeded');

    // Create a protected event with access code
    const vipSlug = `vip-wedding-${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader || '',
      },
      body: JSON.stringify({
        name: 'Protected VIP Wedding',
        slug: vipSlug,
        eventCode: 'VIP2026',
        uploadEnabled: true,
      }),
    });
    assert(createRes.ok, 'Created protected event with code VIP2026');

    // Attempt upload without code -> should be 401
    const unauthForm = new FormData();
    unauthForm.append('file', new Blob([createFakeJpegBuffer()], { type: 'image/jpeg' }), 'attempt.jpg');
    unauthForm.append('slug', vipSlug);
    const unauthRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: unauthForm,
    });
    assert(unauthRes.status === 401, 'Upload rejected with 401 when access code is missing/incorrect');

    // Attempt upload with correct code -> should succeed
    const authForm = new FormData();
    authForm.append('file', new Blob([createFakeJpegBuffer()], { type: 'image/jpeg' }), 'authorized.jpg');
    authForm.append('slug', vipSlug);
    authForm.append('accessCode', 'VIP2026');
    const authRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: authForm,
    });
    const authData = await authRes.json();
    assert(authRes.ok && authData.success, 'Upload succeeded with correct access code VIP2026');
  } catch (e) {
    assert(false, `Access code test error: ${e.message}`);
  }

  // --- Test 6: Gallery Loading ---
  console.log('\n--- Test 6: Gallery Loading ---');
  let photoToDeleteId = null;
  try {
    const galleryRes = await fetch(`${BASE_URL}/api/photos?slug=noel-and-danica`);
    const galleryData = await galleryRes.json();
    assert(
      galleryRes.ok && Array.isArray(galleryData.photos) && galleryData.photos.length >= 10,
      `Gallery returned ${galleryData.photos?.length || 0} photos with event metadata`
    );
    if (galleryData.photos?.length > 0) {
      photoToDeleteId = galleryData.photos[0].id;
    }
  } catch (e) {
    assert(false, `Gallery loading failed: ${e.message}`);
  }

  // --- Test 7: Photo Deletion (Trash) ---
  console.log('\n--- Test 7: Photo Deletion ---');
  try {
    if (photoToDeleteId) {
      // Re-login to get fresh cookie
      const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin' }),
      });
      const cookieHeader = loginRes.headers.get('set-cookie');

      const delRes = await fetch(`${BASE_URL}/api/photo/${photoToDeleteId}?slug=noel-and-danica`, {
        method: 'DELETE',
        headers: {
          'Cookie': cookieHeader || '',
        },
      });
      const delData = await delRes.json();
      assert(delRes.ok && delData.success, `Photo ${photoToDeleteId} successfully moved to trash`);

      // Verify it's no longer in the active gallery
      const verifyRes = await fetch(`${BASE_URL}/api/photos?slug=noel-and-danica`);
      const verifyData = await verifyRes.json();
      const stillPresent = verifyData.photos.some((p) => p.id === photoToDeleteId);
      assert(!stillPresent, 'Verified photo is removed from active gallery');
    } else {
      assert(false, 'No photo ID available for deletion test');
    }
  } catch (e) {
    assert(false, `Photo deletion error: ${e.message}`);
  }

  // --- Test 8: ZIP Stream Download ---
  console.log('\n--- Test 8: ZIP Stream Download ---');
  try {
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin' }),
    });
    const cookieHeader = loginRes.headers.get('set-cookie');

    const zipRes = await fetch(`${BASE_URL}/api/export?slug=noel-and-danica`, {
      headers: {
        'Cookie': cookieHeader || '',
      },
    });

    const contentType = zipRes.headers.get('content-type');
    const contentDisposition = zipRes.headers.get('content-disposition');
    const buffer = await zipRes.arrayBuffer();

    assert(zipRes.ok, 'Export endpoint returned HTTP 200');
    assert(contentType?.includes('application/zip'), `Correct Content-Type: ${contentType}`);
    assert(
      contentDisposition?.includes('noel-and-danica-photos.zip'),
      `Correct Content-Disposition: ${contentDisposition}`
    );
    assert(buffer.byteLength > 100, `ZIP payload streamed successfully (size: ${buffer.byteLength} bytes)`);
  } catch (e) {
    assert(false, `ZIP download error: ${e.message}`);
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
