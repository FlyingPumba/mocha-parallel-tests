"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const circular_json_1 = __importDefault(require("circular-json"));
const debug_1 = __importDefault(require("debug"));
const mocha_1 = __importDefault(require("mocha"));
const runner_1 = __importDefault(require("./runner"));
const task_manager_1 = __importDefault(require("./task-manager"));
const util_1 = require("./util");
const thread_1 = require("./thread");
const config_1 = require("../config");
const debugLog = debug_1.default('mocha-parallel-tests');
class MochaWrapper extends mocha_1.default {
    constructor() {
        super(...arguments);
        this.isTypescriptRunMode = false;
        this.requires = [];
        this.compilers = [];
        this.exitImmediately = false;
    }
    setTypescriptRunMode() {
        this.isTypescriptRunMode = true;
    }
    /**
     * All `--require` options should be applied for subprocesses
     */
    addRequiresForSubprocess(requires) {
        this.requires = requires;
    }
    /**
     * All `--compiler` options should be applied for subprocesses
     */
    addCompilersForSubprocess(compilers) {
        this.compilers = compilers;
    }
    setMaxParallel(maxParallel) {
        this.maxParallel = maxParallel;
    }
    enableExitMode() {
        this.exitImmediately = true;
        return this;
    }
    run(onComplete) {
        const { asyncOnly, ignoreLeaks, forbidOnly, forbidPending, fullStackTrace, hasOnly, } = this.options;
        const rootSuite = this.suite;
        const runner = new runner_1.default(rootSuite);
        runner.ignoreLeaks = ignoreLeaks !== false;
        runner.forbidOnly = forbidOnly;
        runner.forbidPending = forbidPending;
        runner.hasOnly = hasOnly;
        runner.fullStackTrace = fullStackTrace;
        runner.asyncOnly = asyncOnly;
        const taskManager = new task_manager_1.default(this.maxParallel);
        for (const file of this.files) {
            const task = () => this.runThread(file);
            taskManager.add(task);
        }
        this.options.files = this.files;
        // Refer to mocha lib/mocha.js run() method for more info here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reporter = new this._reporter(runner, this.options);
        // emit `start` and `suite` events
        // so that reporters can record the start time
        runner.emitStartEvents();
        taskManager.execute();
        taskManager
            .on('taskFinished', (testResults) => {
            const { code, execTime, events, file, syncedSubprocessData, } = testResults;
            debugLog(`File execution finished: ${file}`);
            debugLog(`Has synced data: ${Boolean(syncedSubprocessData)}, number of events: ${events.length}, execution time: ${execTime}`);
            const retriedTests = [];
            if (syncedSubprocessData) {
                this.addSubprocessSuites(testResults);
                retriedTests.push(...this.extractSubprocessRetriedTests(testResults));
            }
            runner.reEmitSubprocessEvents(testResults, retriedTests);
            const hasEndEvent = events.find((event) => event.type === 'runner' && event.event === 'end');
            if (!hasEndEvent && code !== 0) {
                process.exit(code);
            }
        })
            .on('end', () => {
            debugLog('All tests finished processing');
            const done = (failures) => {
                if (reporter.done) {
                    reporter.done(failures, onComplete);
                }
                else if (onComplete) {
                    onComplete(failures);
                }
            };
            runner.emitFinishEvents(done);
        });
        return runner;
    }
    addSubprocessSuites(testArtifacts) {
        const rootSuite = this.suite;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const serialized = testArtifacts.syncedSubprocessData;
        const { rootSuite: testRootSuite } = circular_json_1.default.parse(serialized.results, util_1.subprocessParseReviver);
        Object.assign(testRootSuite, {
            parent: rootSuite,
            root: false,
        });
        rootSuite.suites.push(testRootSuite);
    }
    extractSubprocessRetriedTests(testArtifacts) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const serialized = testArtifacts.syncedSubprocessData;
        const { retriesTests } = circular_json_1.default.parse(serialized.retries, util_1.subprocessParseReviver);
        return retriesTests;
    }
    async runThread(file) {
        const options = this.getThreadOptions();
        const thread = thread_1.getThread(file, options);
        return await thread.run();
    }
    getThreadOptions() {
        const options = {
            compilers: [],
            delay: false,
            exitImmediately: false,
            fullTrace: false,
            isTypescriptRunMode: this.isTypescriptRunMode,
            requires: [],
            file: [],
        };
        for (const requirePath of this.requires) {
            options.requires.push(requirePath);
        }
        for (const compilerPath of this.compilers) {
            options.compilers.push(compilerPath);
        }
        if (this.options.delay) {
            options.delay = true;
        }
        if (this.options.grep) {
            options.grep = this.options.grep.toString();
        }
        if (this.exitImmediately) {
            options.exitImmediately = true;
        }
        if (this.options.fullStackTrace) {
            options.fullTrace = true;
        }
        for (const option of config_1.SUITE_OWN_OPTIONS) {
            options[option] = this.suite[option]();
        }
        return options;
    }
}
exports.default = MochaWrapper;
//# sourceMappingURL=mocha.js.map