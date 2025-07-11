const mongoose = require('mongoose');

const timeLogSchema = mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company',
            required: true,
        },
        staffMember: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Staff',
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        startTime: {
            type: String, // e.g., "09:00"
            required: true,
        },
        endTime: {
            type: String, // e.g., "17:00"
            required: true,
        },
        durationMinutes: {
            type: Number, // Calculated duration in minutes
            required: true,
        },
        job: { // Optional: Link to a specific job if clocking in/out for a job
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Job',
            required: false,
        },
        notes: {
            type: String,
            trim: true,
        },
        status: { // e.g., 'Approved', 'Pending', 'Rejected'
            type: String,
            enum: ['Approved', 'Pending', 'Rejected'],
            default: 'Approved',
        },
    },
    {
        timestamps: true,
    }
);

// Pre-save hook to calculate durationMinutes
timeLogSchema.pre('save', function(next) {
    if (this.startTime && this.endTime) {
        const [startHour, startMinute] = this.startTime.split(':').map(Number);
        const [endHour, endMinute] = this.endTime.split(':').map(Number);

        // Create dummy Date objects for calculation
        const startDate = new Date(this.date);
        startDate.setHours(startHour, startMinute, 0, 0);

        const endDate = new Date(this.date);
        endDate.setHours(endHour, endMinute, 0, 0);

        // Handle overnight shifts if necessary (e.g., if endTime < startTime, add 24 hours to endDate)
        if (endDate < startDate) {
            endDate.setDate(endDate.getDate() + 1);
        }

        const durationMs = endDate - startDate;
        this.durationMinutes = durationMs / (1000 * 60);
    }
    next();
});


const TimeLog = mongoose.model('TimeLog', timeLogSchema);

module.exports = TimeLog;