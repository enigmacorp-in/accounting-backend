const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const PDFDocument = require('pdfkit');
const BusinessDetails = require('../models/BusinessDetails');

// Get all invoices
router.get('/', async (req, res) => {
    try {
        const invoices = await Invoice.find()
            .populate('client')
            .populate('items.product')
            .sort({ createdAt: -1 });
        res.json(invoices);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single invoice
router.get('/:id', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('client')
            .populate('items.product');
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }
        res.json(invoice);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create invoice
router.post('/', async (req, res) => {
    try {
        console.log('Creating invoice with data:', req.body);

        // Validate required fields
        const requiredFields = ['client', 'items', 'subtotal', 'totalTax', 'total'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Missing required fields: ${missingFields.join(', ')}`,
                receivedData: req.body
            });
        }

        // Validate items array
        if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
            return res.status(400).json({
                message: 'Items array is required and must not be empty',
                receivedItems: req.body.items
            });
        }

        // Create invoice with default status if not provided
        const invoiceData = {
            ...req.body,
            status: req.body.status || 'draft',
            date: req.body.date || new Date(),
            dueDate: req.body.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };

        const invoice = new Invoice(invoiceData);
        const newInvoice = await invoice.save();

        // Fetch the populated invoice
        const populatedInvoice = await Invoice.findById(newInvoice._id)
            .populate('client')
            .populate('items.product');

        console.log('Invoice created successfully:', populatedInvoice);
        res.status(201).json(populatedInvoice);
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(400).json({
            message: error.message,
            error: error,
            receivedData: req.body
        });
    }
});

// Update invoice
router.patch('/:id', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Update invoice fields
        const updates = req.body;
        Object.keys(updates).forEach(key => {
            invoice[key] = updates[key];
        });

        const updatedInvoice = await invoice.save();
        const populatedInvoice = await Invoice.findById(updatedInvoice._id)
            .populate('client')
            .populate('items.product');

        res.json(populatedInvoice);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete invoice
router.delete('/:id', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }
        await invoice.deleteOne();
        res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Generate PDF
router.get('/:id/pdf', async (req, res) => {
    let doc;
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('client')
            .populate('items.product');
            
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        const businessDetails = await BusinessDetails.findOne();
        if (!businessDetails) {
            return res.status(404).json({ message: 'Business details not found' });
        }

        // Create PDF document with exact A4 size
        doc = new PDFDocument({ 
            size: 'A4',
            margin: 0 // Remove default margins
        });

        // Handle errors on the doc stream
        doc.on('error', (err) => {
            console.error('Error in PDF generation:', err);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Error generating PDF' });
            }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
        doc.pipe(res);

        // Header section with box
        doc.rect(20, 20, 555, 105).stroke();
        
        // GSTIN and Original Copy at top
        doc.font('Helvetica').fontSize(10)
            .text('GSTIN : ' + businessDetails.gstin.toUpperCase(), 30, 30, { bold: true })
            .text('Original Copy', 495, 25);

        // Center TAX INVOICE heading
        doc.fontSize(12);
        const taxInvoiceWidth = doc.widthOfString('TAX INVOICE');
        doc.text('TAX INVOICE', (595 - taxInvoiceWidth) / 2, 45, { underline: true });

        // Company name and address - precisely centered
        const pageWidth = 595; // A4 width in points
        const pageCenter = pageWidth / 2;

        // Set font and size before measuring company name
        doc.font('Helvetica-Bold').fontSize(14);
        const companyName = businessDetails.name;
        const companyNameWidth = doc.widthOfString(companyName);
        doc.text(companyName, (pageWidth - companyNameWidth) / 2, 60);

        // Set font and size for address details
        doc.font('Helvetica').fontSize(10);
        
        // Center street address
        const streetAddress = businessDetails.address.street;
        const streetWidth = doc.widthOfString(streetAddress);
        doc.text(streetAddress, (pageWidth - streetWidth) / 2, 80);

        // Center city, state, pincode
        const cityAddress = `${businessDetails.address.city}, ${businessDetails.address.state}, ${businessDetails.address.pincode}`;
        const cityWidth = doc.widthOfString(cityAddress);
        doc.text(cityAddress, (pageWidth - cityWidth) / 2, 95);

        // Center contact details
        const contactInfo = `Tel: ${businessDetails.phone}  email: ${businessDetails.email}`;
        const contactWidth = doc.widthOfString(contactInfo);
        doc.text(contactInfo, (pageWidth - contactWidth) / 2, 110);

        // Invoice details section with box - reduced height
        doc.rect(20, 125, 555, 55).stroke();
        // Vertical line to divide invoice and transport details
        doc.moveTo(297.5, 125).lineTo(297.5, 180).stroke();

        // Left side - Invoice details - positions unchanged
        doc.font('Helvetica').fontSize(10)
            .text('Invoice No.', 30, 135)
            .text(':', 120, 135)
            .text(invoice.invoiceNumber, 130, 135)
            .text('Dated', 30, 150)
            .text(':', 120, 150)
            .text(new Date(invoice.date).toLocaleDateString(), 130, 150)
            .text('Place of Supply', 30, 165)
            .text(':', 120, 165)
            .text(invoice.placeOfSupply || '', 130, 165);

        // Right side - Transport details - positions unchanged
        doc.text('GR/RR No.', 307, 135)
            .text(':', 397, 135)
            .text(invoice.transportDetails?.grNumber || '', 407, 135)
            .text('Transport', 307, 150)
            .text(':', 397, 150)
            .text(invoice.transportDetails?.transportName || '', 407, 150)
            .text('Vehicle No.', 307, 165)
            .text(':', 397, 165)
            .text(invoice.transportDetails?.vehicleNumber || '', 407, 165);

        // Billing and Shipping section - moved up
        doc.rect(20, 180, 555, 95).stroke();
        // Vertical line to divide billing and shipping
        doc.moveTo(297.5, 180).lineTo(297.5, 275).stroke();

        // Format address with proper line breaks
        function formatAddress(client) {
            return [
                client.name,
                client.address?.street,
                client.address?.city,
                `${client.address?.state}${client.address?.pincode ? ' - ' + client.address.pincode : ''}`
            ].filter(Boolean).join('\n');
        }

        // Billing details
        doc.font('Helvetica-Bold').text('Billed to:', 30, 185);
        doc.font('Helvetica').text(formatAddress(invoice.client), 30, 200);
        // Add GSTIN at bottom of billed to box
        doc.font('Helvetica').text(`GSTIN/UIN : ${invoice.client.gstin.toUpperCase()}`, 30, 255);

        // Shipping details
        doc.font('Helvetica-Bold').text('Shipped to:', 307, 185);
        doc.font('Helvetica').text(formatAddress(invoice.client), 307, 200);
        // Add GSTIN at bottom of shipped to box
        doc.font('Helvetica').text(`GSTIN/UIN : ${invoice.client.gstin.toUpperCase()}`, 307, 255);

        // Items table
        const tableTop = 275;
        doc.rect(20, tableTop, 555, 350).stroke();

        // Table headers
        doc.rect(20, tableTop, 555, 25).stroke();
        const cols = [
            { x: 20, w: 30, text: 'S.N.' },
            { x: 50, w: 180, text: 'Description of Goods' },
            { x: 230, w: 70, text: 'HSN/SAC\nCode' },
            { x: 300, w: 50, text: 'Qty.' },
            { x: 350, w: 40, text: 'Unit' },
            { x: 390, w: 70, text: 'List Price' },
            { x: 460, w: 40, text: 'Disc.' },
            { x: 500, w: 75, text: 'Amount' }
        ];

        // Draw vertical lines for columns
        cols.forEach(col => {
            doc.moveTo(col.x, tableTop).lineTo(col.x, tableTop + 350).stroke();
        });

        // Add header texts
        doc.font('Helvetica-Bold').fontSize(9);
        cols.forEach(col => {
            doc.text(col.text, col.x + 2, tableTop + 7, { width: col.w - 4, align: 'center' });
        });

        // Add items (without horizontal lines between products)
        let y = tableTop + 25;
        doc.font('Helvetica').fontSize(9);
        
        invoice.items.forEach((item, i) => {
            // Add item details without drawing horizontal lines
            doc.text((i + 1).toString(), cols[0].x + 2, y + 5, { width: cols[0].w - 4, align: 'center' })
                .text(item.product.name, cols[1].x + 2, y + 5, { width: cols[1].w - 4 })
                .text(item.product.hsnCode, cols[2].x + 2, y + 5, { width: cols[2].w - 4, align: 'center' })
                .text(item.quantity.toString(), cols[3].x + 2, y + 5, { width: cols[3].w - 4, align: 'center' })
                .text(item.product.unit, cols[4].x + 2, y + 5, { width: cols[4].w - 4, align: 'center' })
                .text(item.price.toFixed(2), cols[5].x + 2, y + 5, { width: cols[5].w - 4, align: 'right' })
                .text('0.00 %', cols[6].x + 2, y + 5, { width: cols[6].w - 4, align: 'center' })
                .text(item.total.toFixed(2), cols[7].x + 2, y + 5, { width: cols[7].w - 4, align: 'right' });
            
            y += 25;
        });

        // Totals section at bottom of table
        const totalsY = tableTop + 300;
        doc.moveTo(20, totalsY).lineTo(575, totalsY).stroke();
        
        doc.text('Add : IGST', 420, totalsY + 5)
            .text(`@ ${invoice.taxRate}%`, 490, totalsY + 5)
            .text(invoice.totalTax.toFixed(2), 530, totalsY + 5, { align: 'right' });

        doc.moveTo(20, totalsY + 15).lineTo(575, totalsY + 15).stroke();
        
        doc.text('Grand Total', 350, totalsY + 20)
            .text(`${invoice.total.toFixed(2)}`, 530, totalsY + 20, { align: 'right' });

        // Tax breakdown section - moved up by 10px
        const taxY = tableTop + 340;
        doc.rect(20, taxY, 555, 50).stroke();
        
        doc.text('Tax Rate', 30, taxY + 5)
            .text('Taxable Amt.', 120, taxY + 5)
            .text('IGST Amt.', 220, taxY + 5)
            .text('Total Tax', 320, taxY + 5);
            
        doc.text(`${invoice.taxRate}%`, 30, taxY + 25)
            .text(invoice.subtotal.toFixed(2), 120, taxY + 25)
            .text(invoice.totalTax.toFixed(2), 220, taxY + 25)
            .text(invoice.totalTax.toFixed(2), 320, taxY + 25);

        // Amount in words - moved up by 10px
        doc.rect(20, taxY + 50, 555, 30).stroke();
        doc.text('Rupees ' + numberToWords(invoice.total) + ' Only', 30, taxY + 60);

        // Terms and Signature section - moved up by 10px
        const termsY = taxY + 80;
        doc.rect(20, termsY, 555, 92).stroke();
        doc.moveTo(297.5, termsY).lineTo(297.5, termsY + 92).stroke();

        // Terms on left
        doc.fontSize(9)
            .text('Terms and Conditions:', 30, termsY + 5)
            .text('E. & O.E.', 30, termsY + 20)
            .text('1. Goods once sold will not be taken back.', 30, termsY + 35)
            .text('2. Interest @ 18% p.a. will be charged if the payment', 30, termsY + 50)
            .text('   is not made within the stipulated time.', 30, termsY + 65)
            .text('3. Subject to local jurisdiction only.', 30, termsY + 80);

        // Signature section - split into two boxes
        // Top box with Receiver's Signature
        doc.text("Receiver's Signature :", 307, termsY + 5);
        
        // Horizontal line from left to right vertical line
        doc.moveTo(297.5, termsY + 46).lineTo(575, termsY + 46).stroke();
        
        // Bottom box with company name and authorised signatory
        doc.text('for ' + businessDetails.name, 307, termsY + 51, { align: 'right', width: 248 });
        doc.text('Authorised Signatory', 307, termsY + 75, { align: 'right', width: 248 });

        // Draw outer boundary around all content at the end
        const contentHeight = termsY + 92; // Height up to the terms and signature section
        // doc.rect(20, 20, 555, contentHeight).stroke();

        // Finalize PDF
        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        // Clean up the document if it exists
        if (doc) {
            try {
                doc.end();
            } catch (e) {
                console.error('Error closing PDF document:', e);
            }
        }
        if (!res.headersSent) {
            res.status(500).json({ message: error.message });
        }
    }
});

// Helper function to convert number to words
function numberToWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    if (num === 0) return 'Zero';

    function convertLessThanThousand(n) {
        if (n === 0) return '';
        
        if (n < 10) return ones[n];
        
        if (n < 20) return teens[n - 10];
        
        if (n < 100) {
            return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
        }
        
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    }

    let words = '';
    const lakhs = Math.floor(num / 100000);
    const thousands = Math.floor((num % 100000) / 1000);
    const remaining = num % 1000;

    if (lakhs > 0) {
        words += convertLessThanThousand(lakhs) + ' Lakh ';
    }
    if (thousands > 0) {
        words += convertLessThanThousand(thousands) + ' Thousand ';
    }
    if (remaining > 0) {
        words += convertLessThanThousand(remaining);
    }

    return words.trim();
}

module.exports = router; 