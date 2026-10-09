# Task 4 Report
Implemented per brief: slug exported; dollyStackId/dollyStackCase take company; buildDollyResult; openDollyDialog/openTrussDialog take `stock` (default fixed, ''), stock block in classic fieldset only; pre-rig branch unchanged.
Tests: tests added first (RED not captured in output: my grep filter on the first run printed nothing; the tests import not-yet-existing exports so they failed by construction). GREEN: `npm test` 709/709 pass.
Files: js/data/case-library.js, js/model/audioDolly.js, js/ui/dolly-wizard.js, js/ui/truss-wizard.js, tests/{audioDolly,dolly-wizard,truss-wizard}.test.js.
Not browser-verified (no cdp run). No circular import (case-library imports only categories.js).
