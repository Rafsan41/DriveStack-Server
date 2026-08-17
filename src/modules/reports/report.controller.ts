import type { ParamsDictionary } from 'express-serve-static-core';
import { asyncHandler } from '../../core/asyncHandler';
import { sendSuccess } from '../../core/http';
import type { ReportService } from './report.service';
import type { RentalsReportQuery } from './report.types';

export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  public readonly rentalsByMonth = asyncHandler<
    ParamsDictionary,
    unknown,
    unknown,
    RentalsReportQuery
  >(async (req, res) => {
    const report = await this.reportService.getMonthlyRentalReport(req.query);
    sendSuccess(res, 200, `Rental report for ${report.month} generated successfully.`, report);
  });
}
