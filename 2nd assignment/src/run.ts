import { IExecutor } from "./Executor";
import ITask from "./Task";

export default async function run(
    executor: IExecutor,
    queue: AsyncIterable<ITask>,
    maxThreads = 0
) {
    maxThreads = Math.max(0, maxThreads);
    /**
     * Код надо писать сюда
     * Тут что-то вызываем в правильном порядке executor.executeTask для тасков из очереди queue
     */
    const emptyQueue = JSON.parse(JSON.stringify(queue)).q.length === 0;
    const tobeExecuted: ITask[] = [];
    const tasksInExec: { [x: number]: ITask } = {};
    let runningTasks: Array<Promise<any>> = [];
    let queueIndex = 0;

    /*
       iterate through the queue, and add tasks to the tobeExecuted array, and break out of the loop once the maxThreads have been reached or the queue is empty.
    */
    for await (let item of queue) {
        tobeExecuted.push(item);
        queueIndex++;
        if (emptyQueue && queueIndex === maxThreads) {
            break;
        }
    }
    const queItemsLength = JSON.parse(JSON.stringify(queue)).q.length;

    // loop as long as there are still tasks in the tobeExecuted array.
    while (tobeExecuted.length > 0) {
        let taskIndex = 0;
        // loop as long as there are still tasks in the tobeExecuted array
        while (tobeExecuted.length > taskIndex) {
            const task = tobeExecuted[taskIndex];
            if (runningTasks.length >= maxThreads && maxThreads > 0) {
                break;
            }
            // checks if the tasksInExec already has a task stored under the current task's targetId, and if so, increments the taskIndex.
            if (tasksInExec[task.targetId]) {
                taskIndex++;
            } else {
                // remove the current task from the "tasks" array
                tobeExecuted.splice(taskIndex, 1);
                tasksInExec[task.targetId] = task;
                const runTask = executor.executeTask(task).then(async () => {
                    delete tasksInExec[task.targetId];
                    runningTasks = runningTasks.filter(
                        (item) => item !== runTask
                    );
                    const currentQueueItemsLength = JSON.parse(
                        JSON.stringify(queue)
                    ).q.length;

                    if (
                        queItemsLength !== currentQueueItemsLength &&
                        !emptyQueue
                    ) {
                        // meaning there are more tasks in queue, so push it to tobeExecuted
                        for await (const taskItem of queue) {
                            tobeExecuted.push(taskItem);
                        }
                    }
                    if (emptyQueue) {
                        for await (const item of queue) {
                            tobeExecuted.push(item);
                            break;
                        }
                    }
                });
                // after calling executeTask, push it to the runningTasks
                runningTasks.push(runTask);
            }
        }
        await Promise.race(runningTasks);
    }
    // wait for all running tasks to complete before returning.
    return await Promise.all(runningTasks);
}
