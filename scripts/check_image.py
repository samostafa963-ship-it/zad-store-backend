from PIL import Image
import requests
from io import BytesIO

url = "https://zad-backend-production-39a3.up.railway.app/products/6a4af95c241adf8a0f2d964f.png"
img = Image.open(BytesIO(requests.get(url).content))
print("mode:", img.mode)
print("extrema:", img.getextrema())
