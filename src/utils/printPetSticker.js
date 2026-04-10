// Utility function to print pet ID stickers
// Format: 58mm x 30mm thermal sticker with pet information

export const printPetSticker = (petData) => {
  const {
    hospitalName = 'Abbottabad Pet Hospital',
    date = new Date().toLocaleDateString('en-GB'),
    testName = '',
    animalId = '',
    animalName = '',
    species = '',
    sex = '',
    age = '',
    ownerName = ''
  } = petData;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pet ID Sticker</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 210mm;
      height: 297mm;
      font-family: Arial, sans-serif;
    }
    .sticker {
      position: absolute;
      top: 0;
      left: 0;
      width: 90mm;
      height: 50mm;
      border: 3px solid #000;
      padding: 5mm;
      background: white;
    }
    .hospital-name {
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      color: #666;
      margin-bottom: 3mm;
      letter-spacing: 0.5px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2mm;
      font-size: 13px;
      color: #555;
    }
    .row-full {
      margin-bottom: 2mm;
      font-size: 13px;
      color: #555;
    }
    .label {
      font-weight: 600;
    }
    .value {
      font-weight: 400;
    }
    .barcode-value {
      color: #d32f2f;
      font-weight: bold;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="sticker">
    <div class="hospital-name">${hospitalName}</div>
    
    <div class="row">
      <span><span class="label">Date:</span> ${date}</span>
      <span><span class="label">Test:</span> ${testName || 'XXXX'}</span>
    </div>
    
    <div class="row-full">
      <span class="label">Animal ID (Barcode):</span> <span class="barcode-value">${animalId}</span>
    </div>
    
    <div class="row">
      <span><span class="label">Animal Name:</span> ${animalName}</span>
      <span><span class="label">Species:</span> ${species}</span>
    </div>
    
    <div class="row">
      <span><span class="label">Sex:</span> ${sex}</span>
      <span><span class="label">Age:</span> ${age}</span>
    </div>
    
    <div class="row-full">
      <span class="label">Owner Name:</span> ${ownerName}
    </div>
  </div>
</body>
</html>`;

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 250);
};

export default printPetSticker;
