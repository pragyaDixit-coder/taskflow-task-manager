import React from "react";

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className={`p-6 rounded-xl shadow-sm flex items-center justify-between gap-4 bg-white`}>
       <div>
        <p className="text-sm text-gray-600">{title}</p>
        <h3 className="text-2xl font-semibold text-gray-800">{value}</h3>
      </div>
      <div className={`w-12 h-12 flex items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
     
    </div>
  );
};

export default StatCard;
