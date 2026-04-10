import React, { useRef } from 'react';
import { FiPrinter, FiDownload, FiX } from 'react-icons/fi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function ReceiptGenerator({ sale, hospitalSettings, onClose }) {
  const pharmacyReceiptRef = useRef();
  const hospitalReceiptRef = useRef();
  const patientReceiptRef = useRef();

  const generatePDF = async (elementRef, filename) => {
    try {
      const element = elementRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const printReceipt = (elementRef) => {
    const element = elementRef.current;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Receipt</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .receipt { max-width: 800px; margin: 0 auto; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f5f5f5; }
            .header { text-align: center; margin-bottom: 20px; }
            .total { font-weight: bold; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${element.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    try { if (typeof onClose === 'function') onClose(); } catch (e) {}
  };

  const groupItemsByCategory = (items) => {
    return items.reduce((groups, item) => {
      const category = item.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
      return groups;
    }, {});
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const PharmacyReceipt = () => {
    const groupedItems = groupItemsByCategory(sale.items);
    const baseSubtotal = (sale.items || []).reduce((s, it) => s + Number(it.totalPrice || 0), 0);
    const extraCharge = Number(sale.paymentCharge || 0);
    // Pre-compute item-wise charge shares (pro‑rata; adjust last to fix rounding)
    const shares = (sale.items || []).map((it, i, arr) => {
      if (baseSubtotal <= 0 || extraCharge <= 0) return 0;
      if (i < arr.length - 1) return Number(((Number(it.totalPrice||0) / baseSubtotal) * extraCharge).toFixed(2));
      const prev = arr.slice(0, i).reduce((s, x) => s + Number(((Number(x.totalPrice||0) / baseSubtotal) * extraCharge).toFixed(2)), 0);
      return Number((extraCharge - prev).toFixed(2));
    });
    
    return (
      <div ref={pharmacyReceiptRef} className="bg-white p-6 max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-600">
            {hospitalSettings?.hospitalName || 'Pet Hospital'}
          </h1>
          <p className="text-gray-600">{hospitalSettings?.address}</p>
          <p className="text-gray-600">Phone: {hospitalSettings?.phone}</p>
          <h2 className="text-xl font-semibold mt-4 text-green-600">PHARMACY RECEIPT</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p><strong>Invoice No:</strong> {sale.invoiceNumber}</p>
            <p><strong>Date:</strong> {formatDate(sale.createdAt)}</p>
            <p><strong>Cashier:</strong> {sale.soldBy}</p>
          </div>
          <div>
            <p><strong>Customer:</strong> {sale.customerName}</p>
            <p><strong>Contact:</strong> {sale.customerContact}</p>
            {sale.petName && <p><strong>Pet:</strong> {sale.petName}</p>}
          </div>
        </div>

        {Object.entries(groupedItems).map(([category, items]) => (
          <div key={category} className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b-2 border-gray-200 pb-1">
              {category}s
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-2">Medicine</th>
                  <th className="text-left p-2">Batch</th>
                  <th className="text-center p-2">Qty/ML</th>
                  <th className="text-right p-2">Rate</th>
                  <th className="text-right p-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const globalIndex = (sale.items || []).indexOf(item);
                  const share = shares[globalIndex] || 0;
                  const qty = item.category === 'Injection' ? Number(item.mlUsed || 0) : Number(item.quantity || 0);
                  const rateInc = qty > 0 ? (share / qty) : 0;
                  const rateWithCharge = Number(item.pricePerUnit || 0) + rateInc;
                  const totalWithCharge = Number(item.totalPrice || 0) + share;
                  return (
                    <tr key={index} className="border-b">
                      <td className="p-2">
                        <div>
                          <div className="font-medium">{item.medicineName}</div>
                          {item.dosage && <div className="text-gray-500 text-xs">{item.dosage}</div>}
                        </div>
                      </td>
                      <td className="p-2 text-gray-600">{item.batchNo}</td>
                      <td className="p-2 text-center">
                        {item.category === 'Injection' ? (
                          <div>
                            <div className="font-medium">{item.mlUsed}ml used</div>
                            <div className="text-xs text-gray-500">
                              {item.remainingMlAfterSale}ml remaining
                            </div>
                          </div>
                        ) : (
                          `${item.quantity} ${item.unit}`
                        )}
                      </td>
                      <td className="p-2 text-right">
                        PKR {rateWithCharge.toFixed(2)}/{item.category === 'Injection' ? 'ml' : item.unit}
                      </td>
                      <td className="p-2 text-right font-medium">PKR {totalWithCharge.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        <div className="border-t-2 border-gray-300 pt-4">
          <div className="flex justify-between mb-2">
            <span>Subtotal:</span>
            <span>PKR {(Number(sale.subtotal||0) + Number(sale.paymentCharge||0)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>Discount:</span>
            <span>PKR {sale.discount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total Amount:</span>
            <span>PKR {sale.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mt-2">
            <span>Payment Method:</span>
            <span>{sale.paymentMethod}</span>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Thank you for choosing our pharmacy!</p>
          <p>For any queries, please contact us at {hospitalSettings?.phone}</p>
        </div>
      </div>
    );
  };

  const HospitalReceipt = () => (
    <div ref={hospitalReceiptRef} className="bg-white p-6 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-blue-600">
          {hospitalSettings?.hospitalName || 'Pet Hospital'}
        </h1>
        <p className="text-gray-600">{hospitalSettings?.address}</p>
        <p className="text-gray-600">Phone: {hospitalSettings?.phone}</p>
        <h2 className="text-xl font-semibold mt-4 text-red-600">HOSPITAL RECORD COPY</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p><strong>Invoice No:</strong> {sale.invoiceNumber}</p>
          <p><strong>Date & Time:</strong> {formatDate(sale.createdAt)}</p>
          <p><strong>Cashier:</strong> {sale.soldBy}</p>
          <p><strong>Payment Method:</strong> {sale.paymentMethod}</p>
        </div>
        <div>
          <p><strong>Customer Name:</strong> {sale.customerName}</p>
          <p><strong>Contact Number:</strong> {sale.customerContact}</p>
          {sale.petName && <p><strong>Pet Name:</strong> {sale.petName}</p>}
          {sale.prescriptionId && <p><strong>Prescription ID:</strong> {sale.prescriptionId}</p>}
        </div>
      </div>

      {(() => {
        const baseSubtotal = (sale.items || []).reduce((s, it) => s + Number(it.totalPrice || 0), 0);
        const extraCharge = Number(sale.paymentCharge || 0);
        const shares = (sale.items || []).map((it, i, arr) => {
          if (baseSubtotal <= 0 || extraCharge <= 0) return 0;
          if (i < arr.length - 1) return Number(((Number(it.totalPrice||0) / baseSubtotal) * extraCharge).toFixed(2));
          const prev = arr.slice(0, i).reduce((s, x) => s + Number(((Number(x.totalPrice||0) / baseSubtotal) * extraCharge).toFixed(2)), 0);
          return Number((extraCharge - prev).toFixed(2));
        });
        return (
      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-2">Medicine Details</th>
            <th className="text-left p-2">Batch Info</th>
            <th className="text-center p-2">Quantity</th>
            <th className="text-right p-2">Rate</th>
            <th className="text-right p-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, index) => {
            const share = shares[index] || 0;
            const qty = item.category === 'Injection' ? Number(item.mlUsed || 0) : Number(item.quantity || 0);
            const rateInc = qty > 0 ? (share / qty) : 0;
            const rateWithCharge = Number(item.pricePerUnit || 0) + rateInc;
            const totalWithCharge = Number(item.totalPrice || 0) + share;
            return (
              <tr key={index} className="border-b">
                <td className="p-2">
                  <div className="font-medium">{item.medicineName}</div>
                  <div className="text-xs text-gray-600">Category: {item.category}</div>
                  {item.dosage && <div className="text-xs text-gray-600">Dosage: {item.dosage}</div>}
                </td>
                <td className="p-2">
                  <div className="text-sm">{item.batchNo}</div>
                  <div className="text-xs text-gray-600">
                    Expiry: {new Date(item.expiryDate).toLocaleDateString()}
                  </div>
                </td>
                <td className="p-2 text-center">
                  {item.category === 'Injection' ? (
                    <div>
                      <div className="font-medium">{item.mlUsed}ml</div>
                      <div className="text-xs text-red-600">
                        Remaining: {item.remainingMlAfterSale}ml
                      </div>
                    </div>
                  ) : (
                    `${item.quantity} ${item.unit}`
                  )}
                </td>
                <td className="p-2 text-right">PKR {rateWithCharge.toFixed(2)}</td>
                <td className="p-2 text-right font-medium">PKR {totalWithCharge.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
        );
      })()}

      <div className="border-t-2 border-gray-300 pt-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between mb-1">
              <span>Subtotal:</span>
              <span>PKR {(Number(sale.subtotal||0) + Number(sale.paymentCharge||0)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Discount:</span>
              <span>PKR {sale.discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total Amount:</span>
              <span>PKR {sale.totalAmount.toFixed(2)}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Authorized Signature</p>
            <div className="border-b border-gray-400 mt-8 mb-2"></div>
            <p className="text-xs text-gray-500">Pharmacist</p>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <p><strong>Note:</strong> This is a hospital record copy. Please retain for audit purposes.</p>
        <p>Generated on: {formatDate(new Date())}</p>
      </div>
    </div>
  );

  const PatientReceipt = () => (
    <div ref={patientReceiptRef} className="bg-white p-6 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-blue-600">
          {hospitalSettings?.hospitalName || 'Pet Hospital'}
        </h1>
        <p className="text-sm text-gray-600">{hospitalSettings?.address}</p>
        <p className="text-sm text-gray-600">Phone: {hospitalSettings?.phone}</p>
        <h2 className="text-lg font-semibold mt-3 text-green-600">PATIENT COPY</h2>
      </div>

      <div className="mb-4 text-sm">
        <div className="flex justify-between mb-1">
          <span>Invoice:</span>
          <span className="font-medium">{sale.invoiceNumber}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Date:</span>
          <span>{new Date(sale.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Patient:</span>
          <span className="font-medium">{sale.customerName}</span>
        </div>
        {sale.petName && (
          <div className="flex justify-between">
            <span>Pet:</span>
            <span className="font-medium">{sale.petName}</span>
          </div>
        )}
      </div>

      <div className="mb-4">
        <h3 className="font-semibold mb-2 text-gray-800">Medicines Dispensed:</h3>
        {(() => {
          const baseSubtotal = (sale.items || []).reduce((s, it) => s + Number(it.totalPrice || 0), 0);
          const extraCharge = Number(sale.paymentCharge || 0);
          const shares = (sale.items || []).map((it, i, arr) => {
            if (baseSubtotal <= 0 || extraCharge <= 0) return 0;
            if (i < arr.length - 1) return Number(((Number(it.totalPrice||0) / baseSubtotal) * extraCharge).toFixed(2));
            const prev = arr.slice(0, i).reduce((s, x) => s + Number(((Number(x.totalPrice||0) / baseSubtotal) * extraCharge).toFixed(2)), 0);
            return Number((extraCharge - prev).toFixed(2));
          });
          return sale.items.map((item, index) => {
            const share = shares[index] || 0;
            const totalWithCharge = Number(item.totalPrice || 0) + share;
            return (
              <div key={index} className="mb-3 p-2 bg-gray-50 rounded">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.medicineName}</div>
                    {item.dosage && (
                      <div className="text-xs text-gray-600 mt-1">
                        <strong>Dosage:</strong> {item.dosage}
                      </div>
                    )}
                    <div className="text-xs text-gray-600">
                      <strong>Quantity:</strong> {
                        item.category === 'Injection' 
                          ? `${item.mlUsed}ml` 
                          : `${item.quantity} ${item.unit}`
                      }
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">PKR {totalWithCharge.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      <div className="border-t pt-3 mb-4">
        <div className="flex justify-between mb-1 text-sm">
          <span>Subtotal:</span>
          <span>PKR {(Number(sale.subtotal||0) + Number(sale.paymentCharge||0)).toFixed(2)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between mb-1 text-sm">
            <span>Discount:</span>
            <span>PKR {sale.discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>Total Paid:</span>
          <span>PKR {sale.totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div className="text-center text-xs text-gray-600">
        <p className="mb-2">
          <strong>Important:</strong> Please follow the prescribed dosage and complete the full course.
        </p>
        <p>For any queries, contact: {hospitalSettings?.phone}</p>
        <p className="mt-2">Thank you for trusting our care!</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Receipt Options</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FiX size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Pharmacy Receipt */}
            <div className="text-center">
              <h3 className="font-semibold mb-2 text-green-600">Pharmacy Receipt</h3>
              <p className="text-sm text-gray-600 mb-3">Medicines grouped by category</p>
              <div className="space-y-2">
                <button
                  onClick={() => printReceipt(pharmacyReceiptRef)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <FiPrinter className="mr-2" size={16} />
                  Print
                </button>
                <button
                  onClick={() => generatePDF(pharmacyReceiptRef, `pharmacy-receipt-${sale.invoiceNumber}.pdf`)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <FiDownload className="mr-2" size={16} />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Hospital Receipt */}
            <div className="text-center">
              <h3 className="font-semibold mb-2 text-red-600">Hospital Record</h3>
              <p className="text-sm text-gray-600 mb-3">Detailed copy for records</p>
              <div className="space-y-2">
                <button
                  onClick={() => printReceipt(hospitalReceiptRef)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <FiPrinter className="mr-2" size={16} />
                  Print
                </button>
                <button
                  onClick={() => generatePDF(hospitalReceiptRef, `hospital-record-${sale.invoiceNumber}.pdf`)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <FiDownload className="mr-2" size={16} />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Patient Receipt */}
            <div className="text-center">
              <h3 className="font-semibold mb-2 text-purple-600">Patient Copy</h3>
              <p className="text-sm text-gray-600 mb-3">Simplified copy with essentials</p>
              <div className="space-y-2">
                <button
                  onClick={() => printReceipt(patientReceiptRef)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <FiPrinter className="mr-2" size={16} />
                  Print
                </button>
                <button
                  onClick={() => generatePDF(patientReceiptRef, `patient-receipt-${sale.invoiceNumber}.pdf`)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <FiDownload className="mr-2" size={16} />
                  Download PDF
                </button>
              </div>
            </div>
          </div>

          {/* Receipt Previews */}
          <div className="space-y-8">
            <div>
              <h4 className="font-semibold mb-3 text-green-600">Pharmacy Receipt Preview:</h4>
              <div className="border rounded-lg overflow-hidden">
                <PharmacyReceipt />
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3 text-red-600">Hospital Record Preview:</h4>
              <div className="border rounded-lg overflow-hidden">
                <HospitalReceipt />
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3 text-purple-600">Patient Copy Preview:</h4>
              <div className="border rounded-lg overflow-hidden">
                <PatientReceipt />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
