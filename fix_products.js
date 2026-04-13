const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

dns.setServers(['8.8.8.8', '8.8.4.4']);

const categoryMap = {
  // مخبوزات
  "كيك & مافن": "bakery_pastries",
  "كرواسون": "bakery_pastries",
  "معجنات": "bakery_pastries",
  "كوكيز & براونيز": "bakery_pastries",
  "دوناتس": "bakery_pastries",
  "تورتيلا": "bakery_pastries",
  "مخبوزات وبيتزا": "bakery_pastries",

  // مشروبات
  "كبسولات القهوة": "drinks",
  "مياه فوريه": "drinks",
  "عصير": "drinks",
  "عصير فريش": "drinks",
  "مشروبات الشعير": "drinks",
  "مشروبات الطاقة": "drinks",
  "مشروبات الرياضة": "drinks",
  "قهوة": "drinks",
  "شاي": "drinks",
  "أعشاب": "drinks",
  "مشروبات متنوعة": "drinks",
  "مركزات": "drinks",

  // ألبان
  "لبن معلب": "dairy",
  "لبن فريش": "dairy",
  "حليب بالنكهات": "dairy",
  "حليب خالي من الاكتوز": "dairy",
  "لبن مجفف": "dairy",
  "زبادي يوناني": "dairy",
  "رايب": "dairy",
  "مشروب زبادي": "dairy",
  "بودينج وزبادي بالنكهات": "dairy",
  "كريمة": "dairy",
  "زبدة": "dairy",
  "لبنة": "dairy",

  // ايس كريم
  "أيس كريم": "ice_cream",
  "حلويات مجمده": "ice_cream",
  "كعك مثلج": "ice_cream",

  // منظفات
  "منظفات الزجاج والاسطح": "laundry_detergents",
  "معطر جو": "laundry_detergents",
  "سائل غسيل الاطباق": "laundry_detergents",
  "مستلزمات غسيل الاطباق الاتوماتيك": "laundry_detergents",
  "منظفات متعددة الاغراض": "laundry_detergents",
  "ادوات التنظيف": "laundry_detergents",
  "مبيدات حشريه": "laundry_detergents",
  "كلور": "laundry_detergents",
  "باندلز منظفات الغسيل": "laundry_detergents",
  "جيل": "laundry_detergents",
  "بودر": "laundry_detergents",
  "مزيل بقع": "laundry_detergents",
  "منعم ملابس": "laundry_detergents",

  // بيض وجبنة
  "بيض مبستر": "eggs_cheese",
  "جبنة فريش": "eggs_cheese",
  "جبنة معلبه": "eggs_cheese",
  "حلاوه طحينية": "eggs_cheese",

  // لحوم
  "مقطعات": "meat_poultry_fish",
  "باقات التوفير": "meat_poultry_fish",
  "بانية": "meat_poultry_fish",
  "لحوم متبلة": "meat_poultry_fish",
  "مأكولات بحرية": "meat_poultry_fish",
  "لحم بلدي": "meat_poultry_fish",
  "فراخ": "meat_poultry_fish",

  // جاهز للأكل
  "مقبلات وسناكس": "ready_to_eat",
  "وجبات جاهزة": "ready_to_eat",

  // خضروات وفاكهة
  "خضروات وفاكهة": "fruits_vegetables",
  "خضروات ورقية": "fruits_vegetables",
  "تمر": "fruits_vegetables",
  "فواكة": "fruits_vegetables",

  // بقالة
  "المعلبات": "grocery",
  "زيت زيتون": "grocery",
  "زيت": "grocery",
  "سمن": "grocery",
  "مخللات": "grocery",
  "صلصه": "grocery",
  "صوصات": "grocery",
  "ارز": "grocery",
  "مكرونه": "grocery",
  "حبوب": "grocery",
  "توابل وبهارات": "grocery",
  "مكونات الخبز": "grocery",
  "سكر & ملح": "grocery",
  "خل": "grocery",
  "مكرونه سريعة التحضير": "grocery",
  "مربي": "grocery",
  "عسل": "grocery",
  "طحينة & حلاوة طحينية": "grocery",
  "سيريالز": "grocery",
  "حلويات": "grocery",

  // مستلزمات منزلية
  "أغلفة الطعام": "home_essentials",
  "مستلزمات المطبخ": "home_essentials",
  "أواني": "home_essentials",
  "أكياس السندوتش والفرن": "home_essentials",
  "أكياس قمامة": "home_essentials",
  "بطاريات": "home_essentials",
  "مستلزمات كهربائية": "home_essentials",
  "مستلزمات الشاطئ": "home_essentials",

  // سناكس
  "حلويات 🍬": "snacks",
  "شيكولاتة 🍫": "snacks",
  "مكسرات 🥜": "snacks",
  "شيبسي 🛍️": "snacks",
  "بسكوت & ويفر 🍪": "snacks",
  "سناكس صحي 🍪": "snacks",
  "سناكس حلو 🍩": "snacks",
  "سناكس مالح 🥨": "snacks",
  "فشار 🍿": "snacks",
  "لبان 🍃": "snacks",
  "لانش بوكس": "snacks",

  // مستلزمات أطفال
  "حفاضات الأطفال": "baby_essentials",
  "العناية بالأطفال": "baby_essentials",
  "لبن الأطفال": "baby_essentials",
  "طعام الأطفال": "baby_essentials",
  "مناديل مبلله": "baby_essentials",

  // مناديل
  "مناديل الوجه": "tissues",
  "مناديل المطبخ": "tissues",
  "مناديل حمام": "tissues",

  // عطور وجمال
  "عطور نسائية": "beauty_perfumes",
  "عطور للرجال": "beauty_perfumes",
  "عطور نيش": "beauty_perfumes",
  "منتجات العناية بالبشرة": "beauty_perfumes",
  "الرعاية بالبشره": "beauty_perfumes",
  "اساسيات الحماية من الشمس": "beauty_perfumes",
  "Skin Care": "beauty_perfumes",
  "Hair Care": "beauty_perfumes",
  "شاور جيل ولوشن": "beauty_perfumes",
  "شفايف": "beauty_perfumes",
  "وجه": "beauty_perfumes",
  "عيون": "beauty_perfumes",
  "أظافر": "beauty_perfumes",
  "ادوات التجميل": "beauty_perfumes",
  "عطور محلية": "beauty_perfumes",

  // مجمدات
  "خضروات وفاكهة مجمدة": "frozen_food",

  // أدوات مكتبية
  "العاب": "stationery_toys",
};

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  family: 4,
})
.then(async () => {
  console.log('✅ Connected');
  const db = mongoose.connection.db;
  const collection = db.collection('products');

  let updated = 0;

  for (const [subCategory, parentKey] of Object.entries(categoryMap)) {
    const result = await collection.updateMany(
      { category: subCategory, parent_category: { $exists: false } },
      { $set: { parent_category: parentKey } }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ ${subCategory} → ${parentKey} (${result.modifiedCount} منتج)`);
      updated += result.modifiedCount;
    }
  }

  const remaining = await collection.find({ 
    parent_category: { $exists: false } 
  }).toArray();
  
  if (remaining.length > 0) {
    console.log(`\n⚠️ ${remaining.length} منتج مش متصنف بعد:`);
    const uniqueCategories = [...new Set(remaining.map(p => p.category))];
    uniqueCategories.forEach(c => console.log(`  - ${c}`));
  }

  console.log(`\n🎉 تم تحديث ${updated} منتج إضافي!`);
  mongoose.disconnect();
})
.catch(err => console.error('❌', err));