import React, { useRef } from "react";
import { FiPrinter, FiX } from "react-icons/fi";

export default function CustomerReturnReceipt({
  returnData,
  hospitalSettings,
  onClose,
}) {
  const receiptRef = useRef();

  const printReceipt = () => {
    const element = receiptRef.current;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Customer Return Receipt</title>
          <style>
            @page { size: 80mm auto; margin: 2mm; }
            body { 
              font-family: 'Courier New', monospace; 
              margin: 0; 
              padding: 2mm; 
              font-size: 11px;
              line-height: 1.4;
              color: #000;
            }
            .receipt { 
              width: 76mm; 
              margin: 0 auto; 
            }
            .center { text-align: center; }
            .left { text-align: left; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .header { 
              text-align: center; 
              font-weight: bold; 
              font-size: 14px;
              margin-bottom: 5px;
            }
            .line { 
              border-bottom: 1px solid #000; 
              margin: 3px 0; 
              height: 1px;
            }
            .dashed-line { 
              border-bottom: 1px dashed #000; 
              margin: 3px 0; 
              height: 1px;
            }
            .double-line { 
              border-bottom: 2px solid #000; 
              margin: 4px 0; 
              height: 2px;
            }
            .row { 
              display: flex; 
              justify-content: space-between; 
              margin: 1px 0;
              align-items: baseline;
            }
            .item-table {
              width: 100%;
              margin: 5px 0;
            }
            .item-header {
              display: flex;
              justify-content: space-between;
              font-weight: bold;
              border-bottom: 1px solid #000;
              padding-bottom: 2px;
              margin-bottom: 3px;
            }
            .item-row {
              display: flex;
              justify-content: space-between;
              margin: 2px 0;
              padding: 1px 0;
            }
            .item-name { flex: 2; }
            .item-qty { flex: 1; text-align: center; }
            .item-price { flex: 1; text-align: right; }
            .total-section {
              margin-top: 5px;
              padding-top: 3px;
            }
            @media print {
              body { margin: 0; font-size: 10px; }
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
    printWindow.onafterprint = () => {
      printWindow.close();
      if (typeof onClose === "function") onClose();
    };
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Customer Return Receipt</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="text-center mb-4">
            <button
              onClick={printReceipt}
              className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mx-auto"
            >
              <FiPrinter className="mr-2" size={16} />
              Print Receipt
            </button>
          </div>

          {/* Receipt Preview */}
          <div className="border rounded-lg overflow-hidden bg-gray-50 p-2">
            <div
              ref={receiptRef}
              className="bg-white p-4 max-w-sm mx-auto font-mono text-xs"
            >
              {/* Header */}
              <div className="text-center mb-3">
                <div className="font-bold text-lg mb-1">
                  {hospitalSettings?.hospitalName || "Abbottabad Pet Hospital"}
                </div>
                <div className="border-b-2 border-black my-2"></div>
                <div className="font-bold text-sm mb-2">
                  Return Receipt # {returnData.returnNumber}
                </div>
              </div>

              {/* Customer Info */}
              <div className="mb-3 text-xs">
                <div>Customer: {returnData.customerName}</div>
                <div>Date: {formatDate(returnData.returnDate)}</div>
                {returnData.originalInvoiceNumber && (
                  <div>
                    Original Invoice: {returnData.originalInvoiceNumber}
                  </div>
                )}
              </div>

              <div className="border-b border-dashed border-black my-3"></div>

              {/* Items Table */}
              <div className="mb-3">
                <div className="flex justify-between font-bold text-xs border-b border-black pb-1 mb-2">
                  <span style={{ width: "50%" }}>Item</span>
                  <span style={{ width: "20%", textAlign: "center" }}>Qty</span>
                  <span style={{ width: "30%", textAlign: "right" }}>
                    Amount
                  </span>
                </div>

                {returnData.items.map((item, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-xs py-1">
                      <span style={{ width: "50%" }}>{item.medicineName}</span>
                      <span style={{ width: "20%", textAlign: "center" }}>
                        {item.quantity}
                      </span>
                      <span style={{ width: "30%", textAlign: "right" }}>
                        PKR {item.totalReturnAmount.toFixed(0)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      Batch: {item.batchNo} | {item.reason}
                    </div>
                    {index < returnData.items.length - 1 && (
                      <div className="border-b border-dotted border-gray-400 my-1"></div>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-b border-dashed border-black my-3"></div>

              {/* Totals */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>Subtotal:</span>
                  <span className="font-bold">
                    PKR {returnData.totalReturnAmount.toFixed(0)}
                  </span>
                </div>
                <div className="border-b-2 border-black my-2"></div>
                <div className="flex justify-between font-bold text-sm">
                  <span>Total:</span>
                  <span>PKR {returnData.totalReturnAmount.toFixed(0)}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-black my-3"></div>

              {/* Footer */}
              <div className="text-center text-xs">
                <div className="mb-1">Thank you for your understanding!</div>
                <div className="text-xs text-gray-600">
                  Refund Method: {returnData.refundMethod}
                </div>
                <div className="text-xs text-gray-600">
                  Status: {returnData.refundStatus}
                </div>
              </div>

              {returnData.notes && (
                <div className="mt-3 text-xs">
                  <div className="font-bold">Notes:</div>
                  <div>{returnData.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
