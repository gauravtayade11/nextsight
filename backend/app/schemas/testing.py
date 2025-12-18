"""Schemas for test results and code coverage."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TestFramework(str, Enum):
    """Supported test frameworks."""
    PYTEST = "pytest"
    JEST = "jest"
    VITEST = "vitest"
    MOCHA = "mocha"
    JUNIT = "junit"
    RSPEC = "rspec"
    GO_TEST = "go_test"
    OTHER = "other"


class TestStatus(str, Enum):
    """Individual test status."""
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"


# ============== Test Case Schemas ==============

class TestCaseDetail(BaseModel):
    """Individual test case details."""
    name: str
    suite: Optional[str] = None
    className: Optional[str] = None
    status: TestStatus
    duration: Optional[float] = None  # seconds
    errorMessage: Optional[str] = None
    stackTrace: Optional[str] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None


class TestResultCreate(BaseModel):
    """Create test results for a pipeline run."""
    run_id: str
    stage_id: Optional[str] = None
    framework: TestFramework = TestFramework.OTHER
    test_file_pattern: Optional[str] = None
    total_tests: int
    passed_tests: int
    failed_tests: int
    skipped_tests: int = 0
    error_tests: int = 0
    duration_seconds: Optional[float] = None
    test_details: List[TestCaseDetail] = Field(default_factory=list)
    report_url: Optional[str] = None
    junit_xml_url: Optional[str] = None


class TestResultResponse(BaseModel):
    """Test results response."""
    id: str
    runId: str
    stageId: Optional[str] = None
    framework: str
    totalTests: int
    passedTests: int
    failedTests: int
    skippedTests: int
    errorTests: int
    durationSeconds: Optional[float] = None
    passRate: float
    testDetails: List[Dict[str, Any]] = Field(default_factory=list)
    failedTestNames: List[str] = Field(default_factory=list)
    reportUrl: Optional[str] = None
    junitXmlUrl: Optional[str] = None
    createdAt: Optional[str] = None

    class Config:
        from_attributes = True


class TestSummary(BaseModel):
    """Summary of test results for quick display."""
    totalTests: int
    passedTests: int
    failedTests: int
    skippedTests: int
    passRate: float
    framework: Optional[str] = None


# ============== Coverage Schemas ==============

class FileCoverageDetail(BaseModel):
    """Coverage details for a single file."""
    filePath: str
    coverage: float  # percentage
    linesCovered: int
    linesTotal: int
    missingLines: List[int] = Field(default_factory=list)
    branchCoverage: Optional[float] = None


class CoverageCreate(BaseModel):
    """Create coverage data for a pipeline run."""
    run_id: str
    stage_id: Optional[str] = None
    coverage_tool: str = "unknown"
    line_coverage: Optional[float] = None
    branch_coverage: Optional[float] = None
    statement_coverage: Optional[float] = None
    function_coverage: Optional[float] = None
    total_lines: Optional[int] = None
    covered_lines: Optional[int] = None
    missing_lines: Optional[int] = None
    total_branches: Optional[int] = None
    covered_branches: Optional[int] = None
    file_coverage: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    lowest_coverage_files: List[Dict[str, Any]] = Field(default_factory=list)
    report_url: Optional[str] = None
    lcov_url: Optional[str] = None


class CoverageResponse(BaseModel):
    """Coverage data response."""
    id: str
    runId: str
    stageId: Optional[str] = None
    coverageTool: str
    lineCoverage: Optional[float] = None
    branchCoverage: Optional[float] = None
    statementCoverage: Optional[float] = None
    functionCoverage: Optional[float] = None
    totalLines: Optional[int] = None
    coveredLines: Optional[int] = None
    missingLines: Optional[int] = None
    totalBranches: Optional[int] = None
    coveredBranches: Optional[int] = None
    fileCoverage: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    lowestCoverageFiles: List[Dict[str, Any]] = Field(default_factory=list)
    uncoveredLinesSummary: Dict[str, Any] = Field(default_factory=dict)
    reportUrl: Optional[str] = None
    lcovUrl: Optional[str] = None
    coverageChange: Optional[float] = None
    createdAt: Optional[str] = None

    class Config:
        from_attributes = True


class CoverageSummary(BaseModel):
    """Summary of coverage for quick display."""
    lineCoverage: Optional[float] = None
    branchCoverage: Optional[float] = None
    coverageChange: Optional[float] = None
    coverageTool: Optional[str] = None


# ============== Coverage Trend Schemas ==============

class CoverageTrendPoint(BaseModel):
    """Single data point in coverage trend."""
    date: str
    lineCoverage: Optional[float] = None
    branchCoverage: Optional[float] = None
    totalTests: Optional[int] = None
    passedTests: Optional[int] = None
    testPassRate: Optional[float] = None
    runId: Optional[str] = None


class CoverageTrendResponse(BaseModel):
    """Coverage trend data for a pipeline."""
    pipelineId: str
    pipelineName: str
    branch: str
    period: str  # e.g., "30 days"
    dataPoints: List[CoverageTrendPoint] = Field(default_factory=list)
    averageLineCoverage: Optional[float] = None
    coverageTrend: str = "stable"  # "up", "down", "stable"
    testTrend: str = "stable"


# ============== Combined Results ==============

class TestAndCoverageReport(BaseModel):
    """Combined test results and coverage report."""
    runId: str
    pipelineId: str
    pipelineName: str
    branch: str
    commit: Optional[str] = None
    status: str
    startedAt: Optional[str] = None
    completedAt: Optional[str] = None
    # Test summary
    testResults: Optional[TestResultResponse] = None
    testSummary: Optional[TestSummary] = None
    # Coverage summary
    coverage: Optional[CoverageResponse] = None
    coverageSummary: Optional[CoverageSummary] = None
    # Links
    reportUrls: Dict[str, str] = Field(default_factory=dict)


# ============== Request Schemas ==============

class ParseTestResultsRequest(BaseModel):
    """Request to parse test results from output."""
    run_id: str
    stage_id: Optional[str] = None
    output_text: str
    framework: Optional[TestFramework] = None


class ParseCoverageRequest(BaseModel):
    """Request to parse coverage from output."""
    run_id: str
    stage_id: Optional[str] = None
    output_text: str
    coverage_tool: Optional[str] = None
