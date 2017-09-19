var QUnit = require('steal-qunit');
var queues = require("can-queues");
var canDev = require('can-util/js/dev/dev');

QUnit.module('can-queues');



QUnit.test('basics', function() {
	function makeCallbackMeta(handler, context){
		return {
			log: [handler.name + " by " + context.name]
		};
	}
	var callbackOrder = [];
	var gc1, gc2, derivedChild, writableChild, root;
	gc1 = {
		name: "gc1",
		notifyHandlers: [
			function derivedChild_queueUpdate() {
				callbackOrder.push("derivedChild_queueUpdate");
				derivedChild.queueUpdate();
			}
		],
		mutateHandlers: [function gc1_eventHandler_writableChild_dispatch() {
			callbackOrder.push("gc1_eventHandler_writableChild_dispatch");
			writableChild.dispatch();
		}],
		dispatch: function() {
			callbackOrder.push("gc1.dispatch");
			queues.enqueueByQueue({
				notify: this.notifyHandlers,
				mutate: this.mutateHandlers
			}, this, [], makeCallbackMeta);
		}
	};

	gc2 = {
		name: "gc2",
		notifyHandlers: [
			function deriveChild_queueUpdate() {
				callbackOrder.push("deriveChild_queueUpdate");
			}
		],
		mutateHandlers: [],
		dispatch: function() {
			callbackOrder.push("gc2.dispatch");
			queues.enqueueByQueue({
				notify: this.notifyHandlers,
				mutate: this.mutateHandlers
			}, this, [], makeCallbackMeta);
		}
	};

	derivedChild = {
		name: "derivedChild",
		queueUpdate: function() {
			callbackOrder.push("derivedChild.queueUpdate");
			queues.deriveQueue.enqueue(this.update, this, [], {
				priority: 1,
				log: ["update on " + this.name]
			});
		},
		update: function() {
			callbackOrder.push("derivedChild.update");
			// check value
			// value changed
			queues.enqueueByQueue({
				notify: this.notifyHandlers,
				mutate: this.mutateHandlers
			}, this, [], makeCallbackMeta);
		},
		notifyHandlers: [
			function root_queueUpdate() {
				callbackOrder.push("root_queueUpdate");
				root.queueUpdate();
			}
		]
	};
	derivedChild.update = derivedChild.update.bind(derivedChild);

	writableChild = {
		name: "writableChild",
		dispatch: function() {
			callbackOrder.push("writableChild.dispatch");
			// check value
			// value changed
			queues.enqueueByQueue({
				notify: this.notifyHandlers,
				mutate: this.mutateHandlers
			}, this, [], makeCallbackMeta);
		},
		notifyHandlers: [
			function root_queueUpdate() {
				callbackOrder.push("root_queueUpdate");
				root.queueUpdate();
			}
		],
		mutateHandlers: [
			function eventHandler() {
				callbackOrder.push("writableChild.eventHandler");
			}
		]
	};

	root = {
		name: "root",
		queueUpdate: function() {
			callbackOrder.push("root.queueUpdate");
			queues.deriveQueue.enqueue(this.update, this, [], {
				priority: 1,
				log: ["update on " + this.name]
			});
		},
		update: function() {
			callbackOrder.push("root.update");
			// check value
			// value changed
			queues.enqueueByQueue({
				notify: this.notifyHandlers,
				mutate: this.mutateHandlers
			}, this, [], makeCallbackMeta);
		},
		mutateHandlers: [function eventHandler() {
			callbackOrder.push("root.eventHandler");
		}]
	};
	root.update = root.update.bind(root);


	queues.batch.start();
	gc1.dispatch();
	gc2.dispatch();
	queues.batch.stop();

	QUnit.deepEqual(callbackOrder, [
		"gc1.dispatch",
		"gc2.dispatch",
		"derivedChild_queueUpdate",
		"derivedChild.queueUpdate",
		"deriveChild_queueUpdate",
		"derivedChild.update",
		"root_queueUpdate",
		"root.queueUpdate",
		"root.update",
		"gc1_eventHandler_writableChild_dispatch",
		"writableChild.dispatch",
		"root_queueUpdate",
		"root.queueUpdate",
		"root.update",
		"root.eventHandler",
		"writableChild.eventHandler",
		"root.eventHandler"
	], "abc");
});

if (System.env.indexOf('production') < 0) {

	QUnit.test("log basics", function(){
		var oldLog = canDev.log;

		canDev.log = function(area, name) {
			QUnit.equal("Test enqueue task:", area);
			QUnit.equal("fnName", name);

			canDev.log = function(area, name) {
				QUnit.equal("Test run task:", area);
				QUnit.equal("fnName", name);
			};
		};

		var queue = new queues.Queue("Test");
		queue.log();

		queue.enqueue(function fnName(){},null,[]);

		queue.flush();

		canDev.log = oldLog;
	});

	QUnit.test("logStack", function(){
		function makeCallbackMeta(handler, context){
			return {
				log: [handler.name + " by " + context.name]
			};
		}
		var callbackOrder = [];
		var map, fullName, mapFullName;
		// var map = new DefineMap({first: "Justin", last: "Meyer", fullName: ""}); //map:1
		map = {
			name: "map",
			notifyHandlers: [
				function derivedChild_queueUpdate() {
					callbackOrder.push("derivedChild_queueUpdate");
					fullName.queueUpdate();
				}
			],
			dispatch: function() {
				callbackOrder.push("map.dispatch");
				queues.enqueueByQueue({
					notify: this.notifyHandlers,
					mutate: this.mutateHandlers
				}, this, [], makeCallbackMeta, ["map.first = 'ramiya'"]);
			}
		};

		// var fullName = compute(() => {  return map.first + map.last });
		fullName = {
			name: "fullName",
			queueUpdate: function() {
				callbackOrder.push("fullName.queueUpdate");
				queues.deriveQueue.enqueue(this.update, this, [], {
					priority: 1,
					log: ["update on " + this.name]
				});
			},
			update: function update() {
				callbackOrder.push("fullName.update");
				// check value
				// value changed
				queues.enqueueByQueue({
					notify: this.notifyHandlers,
					mutate: this.mutateHandlers
				}, this, [], makeCallbackMeta);
			},
			notifyHandlers: [],
			mutateHandlers: [
				function fullName_setFullNameProperty(){
					mapFullName.dispatch();
				}
			]
		};

		mapFullName = {
			name: "map.fullName",
			mutateHandlers: [function mapFullName_handler() {
				callbackOrder.push("gc1_eventHandler_writableChild_dispatch");
				var stack = queues.stack();
				QUnit.deepEqual( stack.map(function(task){
					return task.meta.stack.name + " " +task.context.name + " " +
						task.fn.name;
				}), [
					"MUTATE map.fullName mapFullName_handler",
					"MUTATE fullName fullName_setFullNameProperty",
					"DERIVE fullName update",
					"NOTIFY map derivedChild_queueUpdate"
				]);
				QUnit.deepEqual(stack[stack.length-1].meta.reasonLog, ["map.first = 'ramiya'"]);
			}],
			dispatch: function() {
				callbackOrder.push("mapFullName.dispatch");
				queues.enqueueByQueue({
					notify: this.notifyHandlers,
					mutate: this.mutateHandlers
				}, this, [], makeCallbackMeta, ["map.fullName = 'Ramiya Meyer'"]);
			}
		};

		// map.first = 'ramiya'
		map.dispatch();


	});

}