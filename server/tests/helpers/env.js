// Imported first by every test so the config module sees test settings.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.BCRYPT_ROUNDS = '4';
process.env.MONGO_URI = '';
process.env.UPLOAD_DIR = `${process.env.TMPDIR || '/tmp'}/connectify-test-uploads-${process.pid}`;
