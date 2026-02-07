"use client";

import { useEffect, useState } from "react";
import { Phone, Users, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";
import TwilioDialer from "@/components/agent/TwilioDialer";
export default function AgentDialer() {
  const [leads, setLeads] = useState<any[]>([]);
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const currentLead = leads[currentLeadIndex];

  const fetchLeads = async () => {
    try {
      const response = await fetch("/api/leads");
      const data = await response.json();
      // Filter only "new" and "callback" leads for dialing
      const dialableLeads = data.leads.filter(
        (lead: any) => lead.status === "new" || lead.status === "callback"
      );
      setLeads(dialableLeads);
    } catch (error) {
      toast.error("Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    if (currentLead) {
      setNotes(currentLead.notes || "");
    }
  }, [currentLead]);

  const handleUpdateStatus = async (status: string) => {
    if (!currentLead) return;

    setUpdating(true);

    try {
      const response = await fetch(`/api/leads/${currentLead._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });

      if (!response.ok) {
        throw new Error("Failed to update lead");
      }

      toast.success(`Lead marked as ${status}`);

      // Move to next lead
      if (currentLeadIndex < leads.length - 1) {
        setCurrentLeadIndex(currentLeadIndex + 1);
      } else {
        toast.success("All leads completed!");
        fetchLeads(); // Refresh to get new leads
        setCurrentLeadIndex(0);
      }

      setNotes("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update lead");
    } finally {
      setUpdating(false);
    }
  };

  const handleCall = () => {
    if (currentLead) {
      // For now, just show the phone number
      // In next step, we'll integrate Twilio
      window.location.href = `tel:${currentLead.phone}`;
      toast.success("Opening dialer...");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading leads...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dialer</h1>
        <p className="text-gray-600 mt-1">Call your assigned leads</p>
      </div>

      {/* Agent Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Leads
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{leads.length}</div>
            <p className="text-xs text-gray-500 mt-1">Assigned to you</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Current Position
            </CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {leads.length > 0 ? currentLeadIndex + 1 : 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">of {leads.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Remaining
            </CardTitle>
            <Phone className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {leads.length - currentLeadIndex}
            </div>
            <p className="text-xs text-gray-500 mt-1">Leads to call</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Progress
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {leads.length > 0
                ? Math.round((currentLeadIndex / leads.length) * 100)
                : 0}
              %
            </div>
            <p className="text-xs text-gray-500 mt-1">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Dialer Card */}
      {currentLead ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Current Lead</span>
              <Badge className="bg-blue-100 text-blue-800">
                {currentLead.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Lead Info */}
            <div className="grid grid-cols-2 gap-4 p-6 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="text-lg font-semibold text-gray-900">
                  {currentLead.name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="text-lg font-semibold text-gray-900">
                  {currentLead.phone}
                </p>
              </div>
              {currentLead.email && (
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {currentLead.email}
                  </p>
                </div>
              )}
              {currentLead.company && (
                <div>
                  <p className="text-sm text-gray-600">Company</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {currentLead.company}
                  </p>
                </div>
              )}
            </div>

            {/* Twilio Dialer */}
<TwilioDialer
  leadId={currentLead._id}
  phoneNumber={currentLead.phone}
  onCallStart={() => toast.success("Call started")}
onCallEnd={() => toast("Call ended")}
/>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Call Notes
              </label>
              <Textarea
                placeholder="Add notes about this call..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            {/* Status Update Buttons */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Update Status:</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleUpdateStatus("interested")}
                  disabled={updating}
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  Interested
                </Button>
                <Button
                  onClick={() => handleUpdateStatus("not_interested")}
                  disabled={updating}
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Not Interested
                </Button>
                <Button
                  onClick={() => handleUpdateStatus("callback")}
                  disabled={updating}
                  variant="outline"
                  className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                >
                  Callback Later
                </Button>
                <Button
                  onClick={() => handleUpdateStatus("dnc")}
                  disabled={updating}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Do Not Call
                </Button>
                <Button
                  onClick={() => handleUpdateStatus("invalid")}
                  disabled={updating}
                  variant="outline"
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  Invalid Number
                </Button>
                <Button
                  onClick={() => handleUpdateStatus("converted")}
                  disabled={updating}
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  Converted
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              All Caught Up! 🎉
            </h3>
            <p className="text-gray-600">
              You've completed all your assigned leads. Great job!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}