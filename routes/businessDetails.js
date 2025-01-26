const express = require('express');
const router = express.Router();
const BusinessDetails = require('../models/BusinessDetails');

// Get business details
router.get('/', async (req, res) => {
    try {
        const businessDetails = await BusinessDetails.findOne();
        if (!businessDetails) {
            return res.status(404).json({ message: 'Business details not found' });
        }
        res.json(businessDetails);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create or update business details
router.post('/', async (req, res) => {
    try {
        let businessDetails = await BusinessDetails.findOne();
        
        if (businessDetails) {
            // Update existing details
            Object.assign(businessDetails, req.body);
            businessDetails = await businessDetails.save();
        } else {
            // Create new details
            businessDetails = new BusinessDetails(req.body);
            businessDetails = await businessDetails.save();
        }
        
        res.status(200).json(businessDetails);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update logo
router.patch('/logo', async (req, res) => {
    try {
        const { logo } = req.body;
        if (!logo) {
            return res.status(400).json({ message: 'Logo is required' });
        }

        let businessDetails = await BusinessDetails.findOne();
        if (!businessDetails) {
            return res.status(404).json({ message: 'Business details not found' });
        }

        businessDetails.logo = logo;
        await businessDetails.save();
        
        res.json({ message: 'Logo updated successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router; 