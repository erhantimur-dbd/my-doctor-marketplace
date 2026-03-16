"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Users,
  Stethoscope,
  Globe,
  TrendingUp,
  Bell,
  MapPin,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { updateDoctorWaitlistStatus } from "@/actions/waitlist";
import { COUNTRIES } from "@/lib/constants/countries";
import { formatSpecialtyName } from "@/lib/utils";

const PIE_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-amber-100 text-amber-800",
  converted: "bg-emerald-100 text-emerald-800",
};

interface WaitlistDoctor {
  id: string;
  name: string;
  email: string;
  specialty: string;
  country: string;
  status: string;
  created_at: string;
}

interface LaunchNotification {
  id: string;
  name: string;
  email: string;
  region: string;
  created_at: string;
}

interface Analytics {
  totalDoctors: number;
  totalPatients: number;
  topRegion: string;
  topSpecialty: string;
  byRegion: { region: string; doctors: number; patients: number; total: number }[];
  bySpecialty: { specialty: string; count: number }[];
  weeklyTrend: { week: string; doctors: number; patients: number }[];
  statusBreakdown: { new: number; contacted: number; converted: number };
}

interface Props {
  doctors: WaitlistDoctor[];
  patients: LaunchNotification[];
  analytics: Analytics | null;
}

function countryName(code: string) {
  return COUNTRIES.find((c) => c.code === code)?.name || code;
}

export function WaitlistDashboard({ doctors, patients, analytics }: Props) {
  const [doctorFilter, setDoctorFilter] = useState({ country: "", status: "" });
  const [patientFilter, setPatientFilter] = useState({ region: "" });
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleStatusChange(id: string, status: "new" | "contacted" | "converted") {
    setUpdatingId(id);
    await updateDoctorWaitlistStatus(id, status);
    setUpdatingId(null);
    // Data refreshes via revalidatePath in action
  }

  const filteredDoctors = doctors.filter((d) => {
    if (doctorFilter.country && d.country !== doctorFilter.country) return false;
    if (doctorFilter.status && d.status !== doctorFilter.status) return false;
    return true;
  });

  const filteredPatients = patients.filter((p) => {
    if (patientFilter.region && p.region !== patientFilter.region) return false;
    return true;
  });

  const uniqueCountries = [...new Set(doctors.map((d) => d.country))].sort();
  const uniqueRegions = [...new Set(patients.map((p) => p.region))].sort();

  return (
    <Tabs defaultValue="doctors" className="space-y-4">
      <TabsList>
        <TabsTrigger value="doctors" className="gap-1.5">
          <Stethoscope className="h-4 w-4" />
          Doctors ({doctors.length})
        </TabsTrigger>
        <TabsTrigger value="patients" className="gap-1.5">
          <Bell className="h-4 w-4" />
          Patient Notifications ({patients.length})
        </TabsTrigger>
        <TabsTrigger value="analytics" className="gap-1.5">
          <TrendingUp className="h-4 w-4" />
          Analytics
        </TabsTrigger>
      </TabsList>

      {/* ─── Doctors Tab ─── */}
      <TabsContent value="doctors" className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select
            value={doctorFilter.country}
            onValueChange={(v) =>
              setDoctorFilter((f) => ({ ...f, country: v === "all" ? "" : v }))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {uniqueCountries.map((c) => (
                <SelectItem key={c} value={c}>
                  {countryName(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={doctorFilter.status}
            onValueChange={(v) =>
              setDoctorFilter((f) => ({ ...f, status: v === "all" ? "" : v }))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDoctors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No doctors on the waitlist
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDoctors.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.email}</TableCell>
                      <TableCell>{formatSpecialtyName(d.specialty)}</TableCell>
                      <TableCell>{countryName(d.country)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={STATUS_STYLES[d.status] || ""}>
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={d.status}
                          onValueChange={(v) =>
                            handleStatusChange(d.id, v as "new" | "contacted" | "converted")
                          }
                          disabled={updatingId === d.id}
                        >
                          <SelectTrigger className="h-8 w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="converted">Converted</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ─── Patient Notifications Tab ─── */}
      <TabsContent value="patients" className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select
            value={patientFilter.region}
            onValueChange={(v) =>
              setPatientFilter({ region: v === "all" ? "" : v })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {uniqueRegions.map((r) => (
                <SelectItem key={r} value={r}>
                  {countryName(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No patient notifications yet
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPatients.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                      <TableCell>{countryName(p.region)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ─── Analytics Tab ─── */}
      <TabsContent value="analytics" className="space-y-6">
        {!analytics ? (
          <p className="text-muted-foreground">Unable to load analytics.</p>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Waitlist Doctors
                  </CardTitle>
                  <Stethoscope className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalDoctors}</div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.statusBreakdown.new} new, {analytics.statusBreakdown.contacted} contacted
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Patient Notifications
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalPatients}</div>
                  <p className="text-xs text-muted-foreground">
                    Awaiting launch in their region
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Top Region
                  </CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{countryName(analytics.topRegion)}</div>
                  <p className="text-xs text-muted-foreground">
                    Most requested expansion market
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Top Specialty
                  </CardTitle>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatSpecialtyName(analytics.topSpecialty)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Most common doctor specialty
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Region breakdown bar chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Demand by Region</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.byRegion.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.byRegion.map((r) => ({ ...r, region: countryName(r.region) }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="region" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="doctors" fill="#0ea5e9" name="Doctors" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="patients" fill="#8b5cf6" name="Patients" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Specialty pie chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Doctors by Specialty</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.bySpecialty.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.bySpecialty.slice(0, 8).map((s) => ({
                            name: formatSpecialtyName(s.specialty),
                            value: s.count,
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                          }
                          outerRadius={100}
                          dataKey="value"
                        >
                          {analytics.bySpecialty.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Weekly trend line chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Weekly Sign-up Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="doctors"
                        stroke="#0ea5e9"
                        name="Doctors"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="patients"
                        stroke="#8b5cf6"
                        name="Patients"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Status breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Doctor Waitlist Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-sm">New: {analytics.statusBreakdown.new}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="text-sm">Contacted: {analytics.statusBreakdown.contacted}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="text-sm">Converted: {analytics.statusBreakdown.converted}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
