import { getDoctorWaitlist } from "@/actions/availability-alerts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";

export default async function DoctorWaitlistPage() {
  const { waiting, waitingCount, error } = await getDoctorWaitlist();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Waiting list</h1>
        <p className="text-muted-foreground">
          Patients who asked to be notified when you open new appointments.
          Guests can join without an account — a strong demand signal for your
          calendar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-amber-50 p-3">
              <Bell className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Waiting now</p>
              <p className="text-2xl font-bold">{waitingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-muted p-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total interest</p>
              <p className="text-2xl font-bold">{waiting.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>People waiting</CardTitle>
          <CardDescription>
            When you free a slot (or a booking is cancelled), we email everyone
            still waiting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {!error && waiting.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              No one is on your waitlist yet. When patients tap &quot;Notify Me
              When Available&quot; on your profile, they&apos;ll appear here.
            </p>
          )}
          {waiting.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Joined</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {waiting.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{row.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {row.email}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline">
                          {row.isGuest ? "Guest" : "Account"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(row.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            row.status === "waiting" ? "default" : "secondary"
                          }
                        >
                          {row.status === "waiting" ? "Waiting" : "Notified"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
