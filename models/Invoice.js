const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    total: {
        type: Number,
        required: true,
        min: 0
    }
});

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        unique: true
    },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    saleType: {
        type: String,
        enum: ['Central - 5%', 'Central - 18%', 'Central - 28%'],
        required: true
    },
    taxRate: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        set: function(saleType) {
            const rates = {
                'Central - 5%': 5,
                'Central - 18%': 18,
                'Central - 28%': 28
            };
            return rates[this.saleType] || 18;
        }
    },
    items: [invoiceItemSchema],
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    totalTax: {
        type: Number,
        required: true,
        min: 0
    },
    total: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'cancelled'],
        default: 'draft'
    },
    notes: String,
    termsAndConditions: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Auto-generate invoice number
invoiceSchema.pre('save', async function(next) {
    try {
        if (!this.invoiceNumber) {
            const lastInvoice = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
            const currentYear = new Date().getFullYear().toString().substr(-2);
            const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
            
            let nextNumber = '0001';
            if (lastInvoice && lastInvoice.invoiceNumber) {
                const lastNumber = parseInt(lastInvoice.invoiceNumber.slice(-4));
                nextNumber = (lastNumber + 1).toString().padStart(4, '0');
            }
            
            this.invoiceNumber = `INV${currentYear}${currentMonth}${nextNumber}`;
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Validate totals
invoiceSchema.pre('save', function(next) {
    try {
        // Calculate expected totals
        const calculatedSubtotal = this.items.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0);
            
        // Calculate tax based on invoice-level tax rate
        const calculatedTotalTax = (calculatedSubtotal * this.taxRate) / 100;
        const calculatedTotal = calculatedSubtotal + calculatedTotalTax;

        // Round to 2 decimal places for comparison
        const roundTo2Decimals = (num) => Math.round(num * 100) / 100;

        // Compare with provided totals
        if (roundTo2Decimals(this.subtotal) !== roundTo2Decimals(calculatedSubtotal)) {
            throw new Error('Invalid subtotal');
        }
        if (roundTo2Decimals(this.totalTax) !== roundTo2Decimals(calculatedTotalTax)) {
            throw new Error('Invalid total tax');
        }
        if (roundTo2Decimals(this.total) !== roundTo2Decimals(calculatedTotal)) {
            throw new Error('Invalid total');
        }

        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('Invoice', invoiceSchema); 