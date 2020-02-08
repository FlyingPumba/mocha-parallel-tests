import { IRunner } from 'mocha';
import MessageChannel from './message-channel';
export interface ReporterConstructor {
    new (runner: IRunner): any;
}
export declare type ReporterFactory = (channel: MessageChannel, debugSubprocess: boolean) => ReporterConstructor;
export declare const getReporterFactory: ReporterFactory;
