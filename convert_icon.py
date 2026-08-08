from PIL import Image

img = Image.open(r"C:\Users\User\.gemini\antigravity-ide\brain\c3c0af66-200b-44d5-8641-222785b5d9a0\calculator_app_icon_1785249229857.png")
icon_sizes = [(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)]
img.save(r"D:\New folder\assets\icon.ico", sizes=icon_sizes)
print("Icon created successfully.")
