"""API routes for test results and code coverage."""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.auth import UserInfo
from app.schemas.testing import (
    TestResultCreate,
    TestResultResponse,
    CoverageCreate,
    CoverageResponse,
    CoverageTrendResponse,
    CoverageTrendPoint,
    TestAndCoverageReport,
    TestSummary,
    CoverageSummary,
)
from app.models.pipeline import (
    PipelineTestResult,
    PipelineCoverage,
    CoverageTrend,
    PipelineRun,
    Pipeline,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/testing", tags=["Testing & Coverage"])


# ============== Test Results Endpoints ==============

@router.post("/runs/{run_id}/tests", response_model=TestResultResponse)
async def create_test_results(
    run_id: str,
    test_data: TestResultCreate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update test results for a pipeline run."""
    # Verify run exists
    result = await db.execute(select(PipelineRun).where(PipelineRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")

    # Calculate pass rate
    total = test_data.total_tests
    pass_rate = (test_data.passed_tests / total * 100) if total > 0 else 0

    # Extract failed test names
    failed_test_names = [
        t.name for t in test_data.test_details
        if t.status.value in ("failed", "error")
    ]

    # Convert test details to dict
    test_details = [t.dict() for t in test_data.test_details]

    # Create test result
    test_result = PipelineTestResult(
        run_id=run_id,
        stage_id=test_data.stage_id,
        framework=test_data.framework.value,
        test_file_pattern=test_data.test_file_pattern,
        total_tests=test_data.total_tests,
        passed_tests=test_data.passed_tests,
        failed_tests=test_data.failed_tests,
        skipped_tests=test_data.skipped_tests,
        error_tests=test_data.error_tests,
        duration_seconds=test_data.duration_seconds,
        pass_rate=pass_rate,
        test_details=test_details,
        failed_test_names=failed_test_names,
        report_url=test_data.report_url,
        junit_xml_url=test_data.junit_xml_url,
    )

    db.add(test_result)
    await db.commit()
    await db.refresh(test_result)

    return test_result.to_dict()


@router.get("/runs/{run_id}/tests", response_model=List[TestResultResponse])
async def get_test_results(
    run_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all test results for a pipeline run."""
    result = await db.execute(
        select(PipelineTestResult)
        .where(PipelineTestResult.run_id == run_id)
        .order_by(desc(PipelineTestResult.created_at))
    )
    test_results = result.scalars().all()
    return [tr.to_dict() for tr in test_results]


@router.get("/runs/{run_id}/tests/{test_id}", response_model=TestResultResponse)
async def get_test_result(
    run_id: str,
    test_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get specific test result by ID."""
    result = await db.execute(
        select(PipelineTestResult)
        .where(PipelineTestResult.id == test_id)
        .where(PipelineTestResult.run_id == run_id)
    )
    test_result = result.scalar_one_or_none()
    if not test_result:
        raise HTTPException(status_code=404, detail="Test result not found")
    return test_result.to_dict()


# ============== Coverage Endpoints ==============

@router.post("/runs/{run_id}/coverage", response_model=CoverageResponse)
async def create_coverage(
    run_id: str,
    coverage_data: CoverageCreate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update coverage data for a pipeline run."""
    # Verify run exists
    result = await db.execute(
        select(PipelineRun)
        .options(selectinload(PipelineRun.pipeline))
        .where(PipelineRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")

    # Calculate coverage change from previous run
    coverage_change = None
    if coverage_data.line_coverage is not None:
        prev_result = await db.execute(
            select(PipelineCoverage)
            .join(PipelineRun)
            .where(PipelineRun.pipeline_id == run.pipeline_id)
            .where(PipelineCoverage.run_id != run_id)
            .where(PipelineCoverage.line_coverage.isnot(None))
            .order_by(desc(PipelineCoverage.created_at))
            .limit(1)
        )
        prev_coverage = prev_result.scalar_one_or_none()
        if prev_coverage and prev_coverage.line_coverage:
            coverage_change = coverage_data.line_coverage - prev_coverage.line_coverage

    # Create coverage record
    coverage = PipelineCoverage(
        run_id=run_id,
        stage_id=coverage_data.stage_id,
        coverage_tool=coverage_data.coverage_tool,
        line_coverage=coverage_data.line_coverage,
        branch_coverage=coverage_data.branch_coverage,
        statement_coverage=coverage_data.statement_coverage,
        function_coverage=coverage_data.function_coverage,
        total_lines=coverage_data.total_lines,
        covered_lines=coverage_data.covered_lines,
        missing_lines=coverage_data.missing_lines,
        total_branches=coverage_data.total_branches,
        covered_branches=coverage_data.covered_branches,
        file_coverage=coverage_data.file_coverage,
        lowest_coverage_files=coverage_data.lowest_coverage_files,
        report_url=coverage_data.report_url,
        lcov_url=coverage_data.lcov_url,
        coverage_change=coverage_change,
    )

    db.add(coverage)

    # Also add to coverage trend
    trend = CoverageTrend(
        pipeline_id=run.pipeline_id,
        run_id=run_id,
        branch=run.branch,
        line_coverage=coverage_data.line_coverage,
        branch_coverage=coverage_data.branch_coverage,
    )
    db.add(trend)

    await db.commit()
    await db.refresh(coverage)

    return coverage.to_dict()


@router.get("/runs/{run_id}/coverage", response_model=List[CoverageResponse])
async def get_coverage(
    run_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all coverage data for a pipeline run."""
    result = await db.execute(
        select(PipelineCoverage)
        .where(PipelineCoverage.run_id == run_id)
        .order_by(desc(PipelineCoverage.created_at))
    )
    coverage_data = result.scalars().all()
    return [c.to_dict() for c in coverage_data]


@router.get("/runs/{run_id}/coverage/{coverage_id}", response_model=CoverageResponse)
async def get_coverage_detail(
    run_id: str,
    coverage_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get specific coverage data by ID."""
    result = await db.execute(
        select(PipelineCoverage)
        .where(PipelineCoverage.id == coverage_id)
        .where(PipelineCoverage.run_id == run_id)
    )
    coverage = result.scalar_one_or_none()
    if not coverage:
        raise HTTPException(status_code=404, detail="Coverage data not found")
    return coverage.to_dict()


# ============== Coverage Trend Endpoints ==============

@router.get("/pipelines/{pipeline_id}/coverage-trend", response_model=CoverageTrendResponse)
async def get_coverage_trend(
    pipeline_id: str,
    branch: str = Query("main", description="Branch to get trend for"),
    days: int = Query(30, ge=1, le=90, description="Number of days of history"),
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get coverage trend for a pipeline over time."""
    # Get pipeline
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    # Get trend data
    from datetime import datetime, timedelta
    from_date = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(CoverageTrend)
        .where(CoverageTrend.pipeline_id == pipeline_id)
        .where(CoverageTrend.branch == branch)
        .where(CoverageTrend.recorded_at >= from_date)
        .order_by(CoverageTrend.recorded_at)
    )
    trends = result.scalars().all()

    # Build data points
    data_points = []
    for trend in trends:
        data_points.append(CoverageTrendPoint(
            date=trend.recorded_at.strftime("%Y-%m-%d") if trend.recorded_at else "",
            lineCoverage=round(trend.line_coverage, 1) if trend.line_coverage else None,
            branchCoverage=round(trend.branch_coverage, 1) if trend.branch_coverage else None,
            totalTests=trend.total_tests,
            passedTests=trend.passed_tests,
            testPassRate=round(trend.test_pass_rate, 1) if trend.test_pass_rate else None,
            runId=trend.run_id,
        ))

    # Calculate average and trend direction
    avg_coverage = None
    coverage_trend = "stable"
    if data_points:
        coverages = [d.lineCoverage for d in data_points if d.lineCoverage is not None]
        if coverages:
            avg_coverage = sum(coverages) / len(coverages)
            if len(coverages) >= 2:
                first_half = coverages[:len(coverages)//2]
                second_half = coverages[len(coverages)//2:]
                first_avg = sum(first_half) / len(first_half)
                second_avg = sum(second_half) / len(second_half)
                diff = second_avg - first_avg
                if diff > 2:
                    coverage_trend = "up"
                elif diff < -2:
                    coverage_trend = "down"

    return CoverageTrendResponse(
        pipelineId=pipeline_id,
        pipelineName=pipeline.name,
        branch=branch,
        period=f"{days} days",
        dataPoints=data_points,
        averageLineCoverage=round(avg_coverage, 1) if avg_coverage else None,
        coverageTrend=coverage_trend,
        testTrend="stable",
    )


# ============== Combined Report Endpoints ==============

@router.get("/runs/{run_id}/report", response_model=TestAndCoverageReport)
async def get_test_and_coverage_report(
    run_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get combined test results and coverage report for a run."""
    # Get run with relationships
    result = await db.execute(
        select(PipelineRun)
        .options(
            selectinload(PipelineRun.pipeline),
            selectinload(PipelineRun.test_results),
            selectinload(PipelineRun.coverage_data),
        )
        .where(PipelineRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")

    # Build test summary
    test_response = None
    test_summary = None
    if run.test_results:
        latest_test = run.test_results[0]
        test_response = TestResultResponse(**latest_test.to_dict())
        test_summary = TestSummary(
            totalTests=latest_test.total_tests,
            passedTests=latest_test.passed_tests,
            failedTests=latest_test.failed_tests,
            skippedTests=latest_test.skipped_tests,
            passRate=round(latest_test.pass_rate, 1) if latest_test.pass_rate else 0,
            framework=latest_test.framework,
        )

    # Build coverage summary
    coverage_response = None
    coverage_summary = None
    if run.coverage_data:
        latest_coverage = run.coverage_data[0]
        coverage_response = CoverageResponse(**latest_coverage.to_dict())
        coverage_summary = CoverageSummary(
            lineCoverage=round(latest_coverage.line_coverage, 1) if latest_coverage.line_coverage else None,
            branchCoverage=round(latest_coverage.branch_coverage, 1) if latest_coverage.branch_coverage else None,
            coverageChange=round(latest_coverage.coverage_change, 1) if latest_coverage.coverage_change else None,
            coverageTool=latest_coverage.coverage_tool,
        )

    # Build report URLs
    report_urls = {}
    if test_response and test_response.reportUrl:
        report_urls["testReport"] = test_response.reportUrl
    if test_response and test_response.junitXmlUrl:
        report_urls["junitXml"] = test_response.junitXmlUrl
    if coverage_response and coverage_response.reportUrl:
        report_urls["coverageReport"] = coverage_response.reportUrl
    if coverage_response and coverage_response.lcovUrl:
        report_urls["lcov"] = coverage_response.lcovUrl

    return TestAndCoverageReport(
        runId=run_id,
        pipelineId=run.pipeline_id,
        pipelineName=run.pipeline.name if run.pipeline else "",
        branch=run.branch,
        commit=run.commit_sha,
        status=run.status.value if run.status else "pending",
        startedAt=run.started_at.isoformat() if run.started_at else None,
        completedAt=run.finished_at.isoformat() if run.finished_at else None,
        testResults=test_response,
        testSummary=test_summary,
        coverage=coverage_response,
        coverageSummary=coverage_summary,
        reportUrls=report_urls,
    )


# ============== Summary Endpoints ==============

@router.get("/pipelines/{pipeline_id}/latest-results")
async def get_latest_test_coverage(
    pipeline_id: str,
    branch: Optional[str] = None,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get latest test and coverage results for a pipeline."""
    # Get latest run
    query = (
        select(PipelineRun)
        .options(
            selectinload(PipelineRun.test_results),
            selectinload(PipelineRun.coverage_data),
        )
        .where(PipelineRun.pipeline_id == pipeline_id)
    )
    if branch:
        query = query.where(PipelineRun.branch == branch)
    query = query.order_by(desc(PipelineRun.started_at)).limit(1)

    result = await db.execute(query)
    run = result.scalar_one_or_none()

    if not run:
        return {
            "pipelineId": pipeline_id,
            "hasResults": False,
            "testSummary": None,
            "coverageSummary": None,
        }

    test_summary = None
    if run.test_results:
        latest_test = run.test_results[0]
        test_summary = {
            "totalTests": latest_test.total_tests,
            "passedTests": latest_test.passed_tests,
            "failedTests": latest_test.failed_tests,
            "passRate": round(latest_test.pass_rate, 1) if latest_test.pass_rate else 0,
        }

    coverage_summary = None
    if run.coverage_data:
        latest_coverage = run.coverage_data[0]
        coverage_summary = {
            "lineCoverage": round(latest_coverage.line_coverage, 1) if latest_coverage.line_coverage else None,
            "branchCoverage": round(latest_coverage.branch_coverage, 1) if latest_coverage.branch_coverage else None,
            "coverageChange": round(latest_coverage.coverage_change, 1) if latest_coverage.coverage_change else None,
        }

    return {
        "pipelineId": pipeline_id,
        "hasResults": True,
        "runId": run.id,
        "branch": run.branch,
        "status": run.status.value if run.status else "pending",
        "testSummary": test_summary,
        "coverageSummary": coverage_summary,
    }
