const pngToIco = require('png-to-ico').default;
const fs = require('fs');

pngToIco('C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\c3c0af66-200b-44d5-8641-222785b5d9a0\\calculator_app_icon_1785249229857.png')
  .then(buf => {
    fs.writeFileSync('D:\\New folder\\assets\\icon.ico', buf);
    console.log('Icon successfully converted to icon.ico');
  })
  .catch(console.error);
