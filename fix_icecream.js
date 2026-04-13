const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

dns.setServers(['8.8.8.8', '8.8.4.4']);

mongoose.connect(process.env.MONGO_URI, { family: 4 }).then(async () => {
  const db = mongoose.connection.db;
  const result = await db.collection('products').updateMany(
    { parent_category: { $exists: false } },
    { $set: { parent_category: 'ice_cream' } }
  );
  console.log('✅ تم تحديث', result.modifiedCount, 'منتج');
  mongoose.disconnect();
});