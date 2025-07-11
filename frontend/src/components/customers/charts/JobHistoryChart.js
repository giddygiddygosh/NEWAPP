import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const JobHistoryChart = ({ data }) => {
    if (!data || data.length === 0) {
        return <div className="text-center text-gray-500 py-10">No job history data available to display.</div>;
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart
                data={data}
                margin={{
                    top: 20, right: 30, left: 20, bottom: 5,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" stackId="a" fill="#82ca9d" name="Completed Jobs" />
                <Bar dataKey="cancelled" stackId="a" fill="#fa8072" name="Cancelled Jobs" />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default JobHistoryChart;