import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Boxes, Factory, Users, TrendingUp, AlertTriangle, 
  RotateCw, ShieldCheck, Zap, ClipboardList, Cpu, Award
} from 'lucide-react';
import { 
  getMaterials, getProduction, getStaff, getWorkOrders, getMachines, getQualityInspections 
} from '../utils/storage';
import { triggerHaptic, showToast } from '../utils/feedback';

export default function Dashboard() {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({
    totalMaterials: 0,
    materialItemsCount: 0,
    lowStockCount: 0,
    dailyTarget: 500,
    todayProduced: 0,
    efficiency: 100,
    activeWorkOrders: 0,
    completedWorkOrders: 0,
    runningMachines: 0,
    totalMachines: 0,
    activeStaffCount: 0,
    totalStaffCount: 0,
    qaPassRate: 98,
    chartData: [],
    recentActivity: []
  });

  const loadAllData = async () => {
    try {
      const mats = await getMaterials();
      const prod = await getProduction();
      const stf = await getStaff();
      const ords = await getWorkOrders();
      const machs = await getMachines();
      const qas = await getQualityInspections();

      const safeMats = Array.isArray(mats) ? mats : [];
      const safeStf = Array.isArray(stf) ? stf : [];
      const safeHist = Array.isArray(prod.history) ? prod.history : [];
      const safeOrds = Array.isArray(ords) ? ords : [];
      const safeMachs = Array.isArray(machs) ? machs : [];
      const safeQas = Array.isArray(qas) ? qas : [];

      const totalQty = safeMats.reduce((acc, m) => acc + (Number(m?.quantity) || 0), 0);
      const lowStock = safeMats.filter(m => Number(m?.quantity || 0) <= (Number(m?.minThreshold) || 100)).length;
      
      const latestRun = safeHist.length > 0 ? safeHist[0] : null;
      const todayProd = latestRun ? (Number(latestRun.produced) || 0) : 0;
      const todayTarget = Number(prod.rate) || 500;
      const eff = safeHist.length > 0 && todayTarget > 0 ? Math.round((todayProd / todayTarget) * 100) : 0;

      const activeJobs = safeOrds.filter(o => o.status !== 'Completed').length;
      const doneJobs = safeOrds.filter(o => o.status === 'Completed').length;

      const runningM = safeMachs.filter(m => m.status === 'Running').length;
      const activeStaff = safeStf.filter(s => s && s.status === 'On Duty').length;

      // QA overall pass rate
      const totalInspected = safeQas.reduce((acc, q) => acc + (Number(q.inspectedQty) || 0), 0);
      const totalPassed = safeQas.reduce((acc, q) => acc + (Number(q.passedQty) || 0), 0);
      const overallPassRate = totalInspected > 0 ? Math.round((totalPassed / totalInspected) * 100) : 100;

      // Prepare chart data
      const chart = safeHist
        .slice(0, 7)
        .reverse()
        .map(h => ({
          name: (h?.date || '').slice(5) || 'Run',
          fullDate: h?.date || 'Today',
          produced: Number(h?.produced) || 0,
          target: Number(h?.target) || todayTarget,
          batch: h?.batch || 'Batch'
        }));

      // Activity Feed
      const activity = [];
      if (safeOrds[0]) {
        activity.push({
          id: 'ord-0',
          title: `Job ${safeOrds[0].orderNumber}: ${safeOrds[0].title}`,
          desc: `Status: ${safeOrds[0].status} • ${safeOrds[0].completedQty}/${safeOrds[0].quantity} units`,
          time: safeOrds[0].dueDate || 'Active',
          icon: ClipboardList,
          color: 'text-blue-600 bg-blue-50 border-blue-200'
        });
      }
      if (safeHist[0]) {
        activity.push({
          id: 'prod-0',
          title: `Batch Run: ${safeHist[0].batch || 'Standard'}`,
          desc: `${safeHist[0].produced} units produced (${safeHist[0].shift || 'Morning'} shift)`,
          time: safeHist[0].date || 'Today',
          icon: Factory,
          color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
        });
      }
      if (safeMachs[0]) {
        activity.push({
          id: 'mach-0',
          title: `Asset: ${safeMachs[0].code} (${safeMachs[0].name})`,
          desc: `Fleet Status: ${safeMachs[0].status} • Uptime ${safeMachs[0].uptime}`,
          time: 'Telemetry',
          icon: Cpu,
          color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
        });
      }

      setMetrics({
        totalMaterials: totalQty,
        materialItemsCount: safeMats.length,
        lowStockCount: lowStock,
        dailyTarget: todayTarget,
        todayProduced: todayProd,
        efficiency: eff,
        activeWorkOrders: activeJobs,
        completedWorkOrders: doneJobs,
        runningMachines: runningM,
        totalMachines: safeMachs.length,
        activeStaffCount: activeStaff,
        totalStaffCount: safeStf.length,
        qaPassRate: overallPassRate,
        chartData: chart,
        recentActivity: activity
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  useEffect(() => {
    loadAllData();
    const handleDataChange = () => {
      loadAllData();
    };
    window.addEventListener('prodpulse-data-changed', handleDataChange);
    window.addEventListener('prodpulse-cloud-sync', handleDataChange);
    return () => {
      window.removeEventListener('prodpulse-data-changed', handleDataChange);
      window.removeEventListener('prodpulse-cloud-sync', handleDataChange);
    };
  }, []);

  const handleManualSync = async () => {
    setRefreshing(true);
    await triggerHaptic('light');
    await loadAllData();
    await showToast('Dashboard synced with floor telemetry');
    setTimeout(() => setRefreshing(false), 400);
  };

  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-xl border border-slate-700">
          <p className="font-bold text-slate-200 mb-1">{payload[0]?.payload?.fullDate}</p>
          <p className="text-blue-300 font-medium">Produced: <span className="font-bold text-white">{payload[0].value} units</span></p>
          <p className="text-slate-400">Target: {payload[0]?.payload?.target} units</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Title & Sync Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Enterprise Ops Center</h2>
          <p className="text-xs text-slate-500 font-medium">Shop floor jobs, output velocity & machine fleet</p>
        </div>
        <button
          onClick={handleManualSync}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-sm text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
        >
          <RotateCw size={14} className={`text-blue-600 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Sync</span>
        </button>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Active Work Orders */}
        <div
          onClick={() => navigate('/orders')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md active:scale-95 transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Jobs</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ClipboardList size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.activeWorkOrders} <span className="text-xs font-semibold text-slate-400">jobs</span>
            </div>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                {metrics.completedWorkOrders} completed
              </span>
            </div>
          </div>
        </div>

        {/* Daily Quota & Output */}
        <div
          onClick={() => navigate('/production')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md active:scale-95 transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Shop Target</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Factory size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.todayProduced} <span className="text-xs font-semibold text-slate-400">/ {metrics.dailyTarget}</span>
            </div>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                {metrics.efficiency}% Quota
              </span>
            </div>
          </div>
        </div>

        {/* Machine Fleet Health */}
        <div
          onClick={() => navigate('/production')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md active:scale-95 transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Machine Fleet</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Cpu size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.runningMachines} <span className="text-xs font-semibold text-slate-400">/ {metrics.totalMachines} online</span>
            </div>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                QA: {metrics.qaPassRate}% Pass
              </span>
            </div>
          </div>
        </div>

        {/* Raw Materials Reserve */}
        <div
          onClick={() => navigate('/materials')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md active:scale-95 transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Warehouse Stock</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Boxes size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.totalMaterials.toLocaleString()} <span className="text-xs font-semibold text-slate-400">units</span>
            </div>
            <div className="flex items-center space-x-1 mt-1">
              {metrics.lowStockCount > 0 ? (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md flex items-center">
                  <AlertTriangle size={10} className="mr-1" /> {metrics.lowStockCount} Reorders
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                  Optimal
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-4 text-white shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Zap size={16} className="text-yellow-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Shop Floor Command</h3>
          </div>
          <span className="text-[11px] text-slate-400">Fast Access</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => { triggerHaptic('light'); navigate('/orders'); }}
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 transition text-center"
          >
            <ClipboardList size={18} className="text-blue-300 mb-1" />
            <span className="text-[11px] font-bold text-white leading-tight">Work Orders</span>
          </button>
          <button
            onClick={() => { triggerHaptic('light'); navigate('/production'); }}
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 transition text-center"
          >
            <Factory size={18} className="text-indigo-300 mb-1" />
            <span className="text-[11px] font-bold text-white leading-tight">Batch Run</span>
          </button>
          <button
            onClick={() => { triggerHaptic('light'); navigate('/materials'); }}
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 transition text-center"
          >
            <Boxes size={18} className="text-amber-300 mb-1" />
            <span className="text-[11px] font-bold text-white leading-tight">Materials</span>
          </button>
          <button
            onClick={() => { triggerHaptic('light'); navigate('/floor-ops'); }}
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 transition text-center"
          >
            <Users size={18} className="text-emerald-300 mb-1" />
            <span className="text-[11px] font-bold text-white leading-tight">Floor Ops</span>
          </button>
        </div>
      </div>

      {/* Production Velocity Analytics Chart */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Throughput Velocity</h3>
            <p className="text-[11px] text-slate-500 font-medium">Daily produced units across all active lines</p>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-semibold text-slate-500">
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600 mr-1" /> Units Produced</span>
          </div>
        </div>

        <div className="h-56 sm:h-64 w-full">
          {metrics.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.chartData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="velocityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomChartTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="produced" 
                  stroke="#4f46e5" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#velocityGrad)" 
                  activeDot={{ r: 5, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
              <Factory size={32} className="opacity-40" />
              <p className="text-xs font-semibold">No run history recorded yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Live Floor Stream */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Live Floor Operations Feed</h3>
        <div className="space-y-3">
          {metrics.recentActivity.length > 0 ? (
            metrics.recentActivity.map((act) => {
              const Icon = act.icon;
              return (
                <div key={act.id} className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${act.color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{act.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{act.desc}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 shrink-0">{act.time}</span>
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-slate-400 text-xs">
              No recent floor events. Create work orders or log production runs to start tracking.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
