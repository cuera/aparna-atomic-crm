import { Alert, AlertDescription } from "@/components/ui/alert";

import type { AdmissionImportReport as Report } from "./useAdmissionImport";
import type { RowMessage } from "./validateAdmissionRows";

const RowList = ({ title, rows }: { title: string; rows: RowMessage[] }) =>
  rows.length === 0 ? null : (
    <div className="flex flex-col gap-1">
      <p className="font-medium">{title}</p>
      <ul className="list-disc pl-5 max-h-48 overflow-y-auto">
        {rows.map(({ row, reason }) => (
          <li key={`${row}-${reason}`}>
            Row {row}: {reason}
          </li>
        ))}
      </ul>
    </div>
  );

const plural = (count: number) => `${count} admission${count === 1 ? "" : "s"}`;

/** What the admissions import did, or why it wrote nothing (M-402). */
export const AdmissionImportReport = ({ report }: { report: Report }) => {
  if (report.status === "invalid") {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription className="flex flex-col gap-3">
          <p>
            Nothing was imported: {report.errors.length} row
            {report.errors.length === 1 ? " has" : "s have"} a problem. Fix them
            and import the file again. Row numbers count the header as row 1.
          </p>
          <RowList title="Rows to fix" rows={report.errors} />
          <RowList title="Not errors" rows={report.links} />
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert
      variant={report.status === "stopped" ? "destructive" : "default"}
      role="status"
    >
      <AlertDescription className="flex flex-col gap-3">
        {report.status === "stopped" ? (
          <p>
            The import stopped at row {report.failed.row}:{" "}
            {report.failed.reason}. Imported {plural(report.imported)}
            {report.lastImportedRow
              ? `; the last imported row is row ${report.lastImportedRow}`
              : ""}
            . Import the same file again: rows already imported are skipped.
          </p>
        ) : (
          <p>Imported {plural(report.imported)}.</p>
        )}
        <RowList title="Skipped" rows={report.skipped} />
        <RowList title="Linked parents" rows={report.links} />
      </AlertDescription>
    </Alert>
  );
};
