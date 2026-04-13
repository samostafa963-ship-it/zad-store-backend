const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

dns.setServers(['8.8.8.8', '8.8.4.4']);

const imageMap = {
  "zad_offers": "https://cdn-icons-png.flaticon.com/512/1041/1041916.png",
  "zad_products": "https://cdn-icons-png.flaticon.com/512/3144/3144456.png",
  "zad_coffee": "https://cdn-icons-png.flaticon.com/512/924/924514.png",
  "eggs_cheese": "https://cdn-icons-png.flaticon.com/512/2674/2674505.png",
  "dairy": "https://cdn-icons-png.flaticon.com/512/3050/3050158.png",
  "bakery_pastries": "https://cdn-icons-png.flaticon.com/512/992/992651.png",
  "fruits_vegetables": "https://cdn-icons-png.flaticon.com/512/765/765176.png",
  "meat_poultry_fish": "https://cdn-icons-png.flaticon.com/512/1046/1046751.png",
  "grocery": "https://cdn-icons-png.flaticon.com/512/3081/3081559.png",
  "ready_to_eat": "https://cdn-icons-png.flaticon.com/512/857/857681.png",
  "frozen_food": "https://cdn-icons-png.flaticon.com/512/2454/2454296.png",
  "drinks": "https://cdn-icons-png.flaticon.com/512/2405/2405479.png",
  "snacks": "https://cdn-icons-png.flaticon.com/512/2553/2553691.png",
  "ice_cream": "https://cdn-icons-png.flaticon.com/512/938/938063.png",
  "tissues": "https://cdn-icons-png.flaticon.com/512/2649/2649985.png",
  "laundry_detergents": "https://cdn-icons-png.flaticon.com/512/1005/1005142.png",
  "home_essentials": "https://cdn-icons-png.flaticon.com/512/1680/1680784.png",
  "baby_essentials": "https://cdn-icons-png.flaticon.com/512/3253/3253062.png",
  "beauty_perfumes": "https://cdn-icons-png.flaticon.com/512/2907/2907285.png",
  "vitamins": "https://cdn-icons-png.flaticon.com/512/2917/2917995.png",
  "stationery_toys": "https://cdn-icons-png.flaticon.com/512/1048/1048953.png",
};

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  family: 4,
})
  .then(async () => {
    console.log('✅ Connected');
    const db = mongoose.connection.db;
    const collection = db.collection('categories');

    for (const [key, url] of Object.entries(imageMap)) {
      await collection.updateOne(
        { category_key: key },
        { $set: { image_url: url } }
      );
      console.log(`✅ Updated: ${key}`);
    }

    console.log('🎉 Done!');
    mongoose.disconnect();
  })
  .catch(err => console.error('❌', err));