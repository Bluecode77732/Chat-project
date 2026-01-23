import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class TaskService {
    // Direct instantiation unlike injecting it
    private readonly logger = new Logger('logger')
    // private readonly logger = new Logger(TaskService.name)

    logging() {
        this.logger.debug("");
        this.logger.error("");
        this.logger.log("");
        this.logger.fatal("");
        this.logger.verbose("");
        this.logger.warn("");
    };


}