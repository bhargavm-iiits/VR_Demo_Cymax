import urllib.request
import os

icons = [
    ("bhim.svg", "https://cdn.worldvectorlogo.com/logos/bhim.svg"),
    ("amazonpay.svg", "https://cdn.worldvectorlogo.com/logos/amazon-pay.svg")
]

os.makedirs("public/payment-icons", exist_ok=True)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
}

for name, url in icons:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            with open(f"public/payment-icons/{name}", "wb") as f:
                f.write(response.read())
        print(f"Downloaded {name}")
    except Exception as e:
        print(f"Failed {name}: {e}")
