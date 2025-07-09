const mongoose = require('mongoose');

const DailyTimeRecordSchema = new mongoose.Schema({
    staff: {
        type: mongoose.Schema.ObjectId,
        ref: 'Staff',
        required: true,
        index: true // For efficient lookup by staff
    },
    company: {
        type: mongoose.Schema.ObjectId,
        ref: 'Company',
        required: true,
        index: true // For efficient lookup by company
    },
    date: { // The specific date this record applies to (e.g., YYYY-MM-DD)
        type: Date,
        required: true,
        index: true
    },
    clockInTime: {
        type: Date,
        required: false, // Can be null if only clock-out recorded (e.g., forgot clock-in)
        default: null,
    },
    clockOutTime: {
        type: Date,
        required: false, // Can be null if only clock-in recorded (e.g., forgot clock-out)
        default: null,
    },
    totalMinutes: { // Calculated total time for convenience
        type: Number,
        default: 0,
    },
    isClockedIn: { // Flag to quickly know if staff is currently clocked in
        type: Boolean,
        default: false,
    },
    // Optional fields for future enhancements:
    notes: {
        type: String,
        trim: true,
        default: '',
    },
    // Allows for tracking if the record was auto-completed or manually adjusted
    manualAdjustment: {
        type: Boolean,
        default: false,
    },
    adjustedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User', // User who made the adjustment (admin/manager)
        default: null,
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Pre-save hook to calculate totalMinutes and update isClockedIn flag
DailyTimeRecordSchema.pre('save', function(next) {
    if (this.clockInTime && this.clockOutTime) {
        const diffMs = this.clockOutTime.getTime() - this.clockInTime.getTime();
        this.totalMinutes = Math.round(diffMs / (1000 * 60)); // Convert milliseconds to minutes
        this.isClockedIn = false;
    } else if (this.clockInTime && !this.clockOutTime) {
        this.isClockedIn = true;
        this.totalMinutes = 0; // Reset if only clocked in
    } else {
        this.isClockedIn = false;
        this.totalMinutes = 0; // Reset if neither or only clocked out
    }
    next();
});

// Add a unique compound index to prevent duplicate daily records for a staff member
// This ensures one time record per staff per day (useful if only one shift per day is allowed)
DailyTimeRecordSchema.index({ staff: 1, date: 1 }, { unique: true });

module.exports = mongoose.models.DailyTimeRecord || mongoose.model('DailyTimeRecord', DailyTimeRecordSchema);