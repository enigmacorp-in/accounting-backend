const mongoose = require('mongoose');

const businessDetailsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    address: {
        street: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        pincode: {
            type: String,
            required: true
        }
    },
    phone: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    website: String,
    gstin: {
        type: String,
        required: true
    },
    pan: {
        type: String,
        required: true
    },
    bankDetails: {
        accountName: {
            type: String,
            required: true
        },
        accountNumber: {
            type: String,
            required: true
        },
        bankName: {
            type: String,
            required: true
        },
        ifscCode: {
            type: String,
            required: true
        },
        branch: {
            type: String,
            required: true
        }
    },
    logo: {
        type: String, // base64 encoded image
        required: false
    },
    termsAndConditions: {
        type: String,
        default: "1. Payment is due within 30 days\n2. Goods once sold will not be taken back\n3. Interest at 18% will be charged on delayed payments"
    }
}, {
    timestamps: true
});

// Ensure only one business details document exists
businessDetailsSchema.pre('save', async function(next) {
    try {
        const count = await this.constructor.countDocuments();
        if (count > 0 && !this._id) {
            throw new Error('Only one business details document can exist');
        }
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('BusinessDetails', businessDetailsSchema); 