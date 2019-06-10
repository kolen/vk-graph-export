window.vk = {}

window.vk.Traverser = function(requester) {
	this.friends = []
	this.links = {}
	this.queue = []
	this.queued_ids = {}
	this.requester = requester
}

window.vk.Traverser.prototype.enqueue = function(id, levels) {
	this.queue.push({
		id: id,
		levels: levels
	})
	this.queued_ids[id] = true
}

window.vk.Traverser.prototype.next = function(onComplete) {
	var request = this.queue.shift()
	this.queued_ids[request.id] = undefined
	if (request === undefined) {
		return false;
	}

	var nonleaf = request.levels>0
	var z = this
	this.requester(request.id, nonleaf, function(items) {
		if (nonleaf) {
			z.friends = _.uniq(items.concat(z.friends), function(f) {return f.id})
		}
		z.links[request.id] = _.map(items, function(i) {return i.id})

		if (nonleaf) {
			_.each(items, function(item) {
				if (!z.queued_ids[item.id] && !z.links[item.id]) {
					z.enqueue(item.id, request.levels-1)
				}
			})
		}
		onComplete();
	})
	return true;
}

window.vk.Traverser.prototype.isCompleted = function() {
	return !this.queue.length;
}

window.vk.attributes = [
	{id: 0, title: 'first_name', type: 'string'},
	{id: 1, title: 'last_name', type: 'string'},
	{id: 2, title: 'nickname', type: 'string'},
	{id: 3, title: 'screen_name', type: 'string'},
	{id: 4, title: 'sex', type: 'integer'},
	{id: 5, title: 'photo_50', type: 'string'},
	{id: 6, title: 'relation', type: 'integer'},
	{id: 7, title: 'country', type: 'integer'},
	{id: 8, title: 'city', type: 'integer'},
	{id: 9, title: 'bdate', type: 'string'},
	{id: 10, title: 'timezone', type: 'integer'}
]

window.vk.to_graph = function(friends, links, exclude_ids) {
	var friends_filtered = _.filter(friends, function(f) {return !_.contains(exclude_ids, f.id)})
	var nodes = _.map(friends_filtered, function(f) {
		return {
			id: f.id,
			label: f.first_name + " " + f.last_name,
			attrs: {
				first_name: f.first_name,
				last_name: f.last_name,
				nickname: f.nickname,
				screen_name: f.screen_name,
				sex: f.sex,
				photo_50: f.photo_50,
				relation: f.relation,
				country: f.country,
				city: f.city,
				bdate: f.bdate,
				timezone: f.timezone
			}
		}
	})

	var node_ids = _.object(_.map(nodes, function(n) {return [n.id, true]}))

	var edges = []

	var edge_id = 0
	_.each(links, function(targets, source) {
		if (node_ids[source] !== undefined) {
			_.each(_.filter(targets, function(id) {return node_ids[id] !== undefined}), function(target) {
				edge_id++
				edges.push({
					id: edge_id,
					source: parseInt(source),
					target: target
				})
			})
		}
	})

	return {
		nodes: nodes,
		edges: edges,
		attribute_conf: window.vk.attributes
	}
}

window.vk.requester = function(id, is_detailed, on_result) {
	var fields;
	if (is_detailed) {
		fields = "nickname, screen_name, sex, bdate, city, country, timezone, photo_50, contacts, relation"
	} else {
		fields = ""
	}

	VK.api("friends.get", {fields: fields, uid: id, v: "5.21"}, function (data) {
		if(data.response !== undefined) {
			var items
			if (!is_detailed) {
				items = _.map(data.response.items, function(id) {return {id: id}})
			} else {
				items = _.map(data.response.items, function(u) {
					u.id = u.uid;
					return u;
				})
			}
			on_result(items)
		} else {
			console.error("Received error: ", data)
			// FIXME: handle error, not just ignore it
			on_result([])
		}
	});
}

window.vk.FakeAPI = function() {
	this.num_fake_users = 1000
	var num_connections = 20000
	this.users = {}
	this.connections = {}
	for(var i=1; i<=this.num_fake_users; i++) {
		this.users[i] = this.createFakeUser(i)
		this.connections[i] = []
	}

	for(var ci=1; i<num_connections; i++) {
		var source = _.random(1, this.num_fake_users)
		var target = _.random(1, this.num_fake_users)
		if (source == target) { continue }
		this.createConnection(source, target)
		this.createConnection(target, source)
	}
}

window.vk.FakeAPI.prototype.createConnection = function(source, target) {
	if (!_.contains(this.connections[source], target)) {
		this.connections[source].push(target)
	}
}

window.vk.FakeAPI.prototype.createFakeUser = function(id) {
	return {
		bdate: "20.10.1991",
		city: _.random(1, 1000).toString(),
		country: _.random(1,3).toString(),
		first_name: Math.random().toString(36).slice(2),
		home_phone: "+728346763254",
		id: id,
		last_name: Math.random().toString(36).slice(2),
		nickname: Math.random().toString(36).slice(2),
		online: 1,
		photo_50: "http://cs234765.vk.me/v45384574/5be7/CCDHDC_xw.jpg",
		relation: _.random(1,7).toString(),
		relation_partner: {},
		screen_name: Math.random().toString(36).slice(2),
		sex: _.random(1,2),
		timezone: _.random(-5, 5),
	}
}

window.vk.FakeAPI.prototype.getFriends = function(id, is_detailed) {
	return _.map(this.connections[id], function(id) {
		if (is_detailed) {
			return this.users[id]
		} else {
			return {id: this.users[id].id}
		}
	}, this)
}