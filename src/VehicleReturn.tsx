import React, { useState, useEffect } from 'react';
import { ClipboardCheck, FileWarning, CheckCircle2 } from 'lucide-react';
import { Card, Button } from './components/Common';
import { subscribeToCollection, completeTrip, createMissingReport } from './db';
import { INSPECTION_ITEMS, DOCUMENT_TYPES, cn } from './lib/utils';
import { useAuth } from './AuthContext';

const VehicleReturn: React.FC = () => {
  const { isAdmin, isSubAdmin, isChecker, isLineSupervisor } = useAuth();
  const canReturn = isAdmin || isSubAdmin || isChecker || isLineSupervisor;
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [inspection, setInspection] = useState<any>({
    missingDocuments: [] as string[],
    missingTools: [] as string[],
    notes: ''
  });

  useEffect(() => {
    return subscribeToCollection('trips', (data) => {
      setTrips(data.filter(t => t.status === 'Running'));
    });
  }, []);

  const handleToggleDoc = (doc: string) => {
    setInspection((prev: any) => ({
      ...prev,
      missingDocuments: prev.missingDocuments.includes(doc)
        ? prev.missingDocuments.filter((d: string) => d !== doc)
        : [...prev.missingDocuments, doc]
    }));
  };

  const handleToggleTool = (tool: string) => {
    setInspection((prev: any) => ({
      ...prev,
      missingTools: prev.missingTools.includes(tool)
        ? prev.missingTools.filter((t: string) => t !== tool)
        : [...prev.missingTools, tool]
    }));
  };

  const handleSubmit = async () => {
    if (!selectedTrip) return;
    
    await completeTrip(selectedTrip.id, selectedTrip.vehicleId, inspection);
    
    if (inspection.missingDocuments.length > 0 || inspection.missingTools.length > 0) {
      await createMissingReport({
        tripId: selectedTrip.id,
        vehiclePlate: selectedTrip.vehiclePlate || selectedTrip.vehicleId,
        driverId: selectedTrip.driverId,
        driverName: selectedTrip.driverName,
        driverPhone: selectedTrip.driverPhone || '',
        missingDocuments: inspection.missingDocuments,
        missingTools: inspection.missingTools,
        notes: inspection.notes,
        status: 'Pending',
        date: new Date()
      });
    }

    setSelectedTrip(null);
    setInspection({
      missingDocuments: [],
      missingTools: [],
      notes: ''
    });
  };

  return (
    <div className="space-y-6">
      {!canReturn ? (
        <div className="bg-red-50 p-8 rounded-2xl border border-red-100 text-center">
            <p className="text-red-600 font-bold">You do not have permission to return vehicles.</p>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight text-[10px] sm:text-2xl">Vehicle Return & Inspection</h2>
            <p className="text-sm text-slate-500">Inspect fleet assets upon return and verify documents.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card title="Active Assignments">
                <div className="space-y-3">
                  {trips.map(trip => (
                    <button
                      key={trip.id}
                      onClick={() => setSelectedTrip(trip)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-all",
                        selectedTrip?.id === trip.id
                          ? "bg-slate-50 border-blue-500 ring-1 ring-blue-500 shadow-sm"
                          : "bg-white border-slate-100 hover:border-slate-200"
                      )}
                    >
                      <p className="font-black text-slate-900 text-sm whitespace-nowrap">{trip.vehiclePlate || trip.vehicleId}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{trip.driverName} • {trip.location}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {trip.documentsGiven?.map((d: string) => (
                          <span key={d} className="px-1.5 py-0.5 text-[8px] font-black uppercase bg-slate-100 rounded text-slate-400">{d}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                  {trips.length === 0 && (
                    <div className="text-center py-12 text-slate-400 italic text-sm">
                      <p>No vehicles are currently out on trips.</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2">
              {selectedTrip ? (
                <div className="space-y-6">
                  <Card title={`Return Inspection: ${selectedTrip.vehiclePlate || selectedTrip.vehicleId}`}>
                    <div className="space-y-8">
                      {/* Equipment Checklist */}
                      {selectedTrip.toolsGiven && selectedTrip.toolsGiven.length > 0 && (
                        <div>
                          <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">
                            Tools Return Verification
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedTrip.toolsGiven.map((tool: string) => (
                              <button
                                key={tool}
                                type="button"
                                onClick={() => handleToggleTool(tool)}
                                className={cn(
                                  "px-4 py-2 rounded-lg border text-[10px] font-bold uppercase transition-all",
                                  inspection.missingTools.includes(tool)
                                   ? "bg-red-50 border-red-200 text-red-600"
                                   : "bg-emerald-50 border-emerald-200 text-emerald-600"
                                )}
                              >
                                {tool} {inspection.missingTools.includes(tool) ? '(Missing)' : '(Received)'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Document Verification */}
                      {selectedTrip.documentsGiven && selectedTrip.documentsGiven.length > 0 && (
                        <div>
                          <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">
                            Document Hand-back Verification
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedTrip.documentsGiven.map((doc: string) => (
                              <button
                                key={doc}
                                type="button"
                                onClick={() => handleToggleDoc(doc)}
                                className={cn(
                                  "px-4 py-2 rounded-lg border text-[10px] font-bold uppercase transition-all",
                                  inspection.missingDocuments.includes(doc)
                                   ? "bg-red-50 border-red-200 text-red-600"
                                   : "bg-emerald-50 border-emerald-200 text-emerald-600"
                                )}
                              >
                                {doc} {inspection.missingDocuments.includes(doc) ? '(Missing)' : '(Received)'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                         <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Inspection Notes</label>
                         <textarea 
                           className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 text-sm"
                           placeholder="Enter any damage details or specifics about missing items..."
                           rows={3}
                           value={inspection.notes}
                           onChange={e => setInspection({ ...inspection, notes: e.target.value })}
                         />
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex gap-4">
                        <Button onClick={handleSubmit} className="flex-1 py-3 text-xs uppercase tracking-widest font-bold">Log Final Return</Button>
                        <Button variant="secondary" onClick={() => setSelectedTrip(null)} className="text-xs uppercase tracking-widest">Cancel</Button>
                      </div>
                    </div>
                  </Card>
                </div>
              ) : (
                 <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 border-dashed p-12 text-slate-400 text-center">
                    <ClipboardCheck size={48} className="mb-4 opacity-20" />
                    <p className="font-black text-slate-900 text-sm">Select Active Vehicle</p>
                    <p className="text-xs mt-1">Choose a transport from the list to begin return processing.</p>
                 </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VehicleReturn;
