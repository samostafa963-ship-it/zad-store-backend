import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()
client = MongoClient(os.environ["MONGO_URI"])
db = client.get_default_database()

# دور على أي منتج فيه كلمة "كريمة" أو "طبخ" في الاسم
results = list(db["products"].find({"name": {"$regex": "كريمة"}}))
print(f"عدد النتائج: {len(results)}")
for p in results:
    print(f"- {p.get('name')} | image: {p.get('image')}")
