import { Router } from 'express'
import { requireAuth } from '../middleware/auth'

const router = Router()

function getComplianceCalendar() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-based

  function status(dueMonth: number, dueDay: number): string {
    const due = new Date(year, dueMonth, dueDay)
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (diff < 0) return 'overdue'
    if (diff <= 7) return 'upcoming'
    return 'done'
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const items = [
    { title: 'TDS Deposit (March)', day: '7', month: 'Apr', dueM: 3, dueD: 7, description: 'Deposit TDS for March via Challan 281', note: 'For all sections: 194C, 194J, 194I, 194H, 194A' },
    { title: 'GSTR-1 Filing', day: '11', month: MONTHS[month === 11 ? 0 : month + 1], dueM: month === 11 ? 0 : month + 1, dueD: 11, description: 'File GSTR-1 for outward supplies of previous month' },
    { title: 'GSTR-3B Filing', day: '20', month: MONTHS[month === 11 ? 0 : month + 1], dueM: month === 11 ? 0 : month + 1, dueD: 20, description: 'File GSTR-3B summary return and pay GST', note: 'Interest 18% p.a. on late payment' },
    { title: 'PT Deposit (WB)', day: '21', month: MONTHS[month], dueM: month, dueD: 21, description: 'Deposit Professional Tax via Grips portal (wbifms.gov.in)', note: 'Interest 2%/month on late deposit' },
    { title: 'TDS Return Q1 (26Q)', day: '31', month: 'Jul', dueM: 6, dueD: 31, description: 'File TDS return Form 26Q for Q1 (Apr–Jun)' },
    { title: 'TDS Return Q2 (26Q)', day: '31', month: 'Oct', dueM: 9, dueD: 31, description: 'File TDS return Form 26Q for Q2 (Jul–Sep)' },
    { title: 'TDS Return Q3 (26Q)', day: '31', month: 'Jan', dueM: 0, dueD: 31, description: 'File TDS return Form 26Q for Q3 (Oct–Dec)' },
    { title: 'TDS Return Q4 (26Q)', day: '31', month: 'May', dueM: 4, dueD: 31, description: 'File TDS return Form 26Q for Q4 (Jan–Mar)' },
    { title: 'Income Tax Return (ITR)', day: '31', month: 'Jul', dueM: 6, dueD: 31, description: 'File ITR for FY 2024-25 (AY 2025-26)', note: 'For non-audit cases' },
    { title: 'Tax Audit Report (3CD)', day: '30', month: 'Sep', dueM: 8, dueD: 30, description: 'File Tax Audit Report Form 3CD if turnover > ₹1 Cr', note: 'Penalty: ₹1.5L or 0.5% of turnover' },
    { title: 'Advance Tax Q1', day: '15', month: 'Jun', dueM: 5, dueD: 15, description: 'Pay 15% of estimated annual tax liability' },
    { title: 'Advance Tax Q2', day: '15', month: 'Sep', dueM: 8, dueD: 15, description: 'Pay 45% of estimated annual tax (cumulative)' },
    { title: 'Advance Tax Q3', day: '15', month: 'Dec', dueM: 11, dueD: 15, description: 'Pay 75% of estimated annual tax (cumulative)' },
    { title: 'Advance Tax Q4', day: '15', month: 'Mar', dueM: 2, dueD: 15, description: 'Pay 100% of estimated annual tax (cumulative)' },
  ]

  return items.map(item => ({
    ...item,
    status: status(item.dueM, Number(item.dueD)),
  }))
}

router.get('/', requireAuth, async (_req, res) => {
  res.json({ items: getComplianceCalendar() })
})

export default router
