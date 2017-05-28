import inflection from 'inflection'
import Mustache from 'mustache'

const MAX_SHIP_AMOUNT = 6
const MAX_SHIP_LV = 200 // Doesn't matter, usually we use 999. See usage below

let i18n_module = null

// This part copied from https://github.com/mashpie/i18n-node with MIT license
// if the msg string contains {{Mustache}} patterns we render it as a mini tempalate
const __ = function (s) {
  let tr
  tr = i18n_module.apply(this, arguments)
  if (/{{.*}}/.test(tr)) {
    tr = Mustache.render(tr, arguments[arguments.length - 1])
  }
  return tr
}

// Translate: Returns null if not exist. Used for format controller
const _$ = function (s) {
  let splits
  let tr
  tr = __.apply(this, arguments)
  splits = s.split('.')
  if (tr === splits[splits.length - 1]) {
    return null
  }
  return tr
}

// Create a function, that exactly runs as f, but allows the elements in the
// first argument passed to f (which is an object) accessed by @arg_name
// Example:
//   f = extract_first_arg (a, b) -> console.log @foo + b
//   f({foo: "bar"}, "baz")     // prints "barbaz"
const extractFirstArg = f => function (local_args) {
  let new_f
  new_f = function () {
    return f.apply(Object.assign(this, local_args), arguments)
  }
  return new_f.apply(new_f, arguments)
}

const reqstrPluralize = (str, amount) => {
  if (!_$('req.option.pluralize') || !amount) {
    return str
  }
  return inflection.inflect(str, amount)
}

const reqstrFrequency = (times) => {
  if (!_$('req.option.frequency')) {
    return times
  }
  switch (times) {
    case 1:
      return 'once'
    case 2:
      return 'twice'
    default:
      return `${times} times`
  }
}

const reqstrOrdinalize = (num) => {
  if (!_$('req.option.ordinalize')) {
    return num
  }
  return inflection.ordinalize(`${num}`)
}

const reqstrShip = (ship, amount) => {
  let _s
  let str_one
  if (typeof ship === 'string') {
    str_one = __(ship)
  } else if (Array.isArray(ship)) {
    str_one = (((() => {
      let j
      let len
      let results
      results = []
      for (j = 0, len = ship.length; j < len; j++) {
        _s = ship[j]
        results.push(reqstrShip(_s))
      }
      return results
    }))()).join('/')
  }
  amount = Array.isArray(amount) ? amount[amount.length - 1] : amount
  return reqstrPluralize(str_one, amount)
}

const delimJoin = (strs, delim, delim_last) => {
  if (typeof delim_last === 'undefined' || delim_last === null || strs.length <= 1) {
    return strs.join(delim)
  }
  return strs.slice(0, -1).join(delim) + delim_last + strs[strs.length - 1]
}

//     {
//       "ship":  "晓" | ["空母", "轻母", "水母"],
//       <"amount": 1 | [1, 3] | [3, 3] | [3, 6],>  // 6 == 'inf'
//       <"flagship": true,>
//       <"note": "轻母",>
//       <"select": 5,>    // "any 5 of xxx/xxx ships"
//       <"lv": 99 | [95, 99] | [100, 999],>   // 999 == 'inf'
//     }, ...
const reqstrGroup = extractFirstArg(function (group) {
  let str_amount
  let str_flagship
  let str_lv
  let str_note
  let str_select
  let str_ship
  str_amount = this.amount ? Array.isArray(this.amount) ? this.amount[0] === this.amount[1] ? _$('req.group.amountonly', `${this.amount[0]}`) : this.amount[1] >= MAX_SHIP_AMOUNT ? _$('req.group.amountmore', `${this.amount[0]}`) : _$('req.group.amount', `${this.amount[0]}~${this.amount[1]}`) : _$('req.group.amount', `${this.amount}`) : ''
  if (this.lv) {
    if (Array.isArray(this.lv)) {
      if (this.lv[1] >= MAX_SHIP_LV) {
        str_lv = _$('req.group.lvmore', `${this.lv[0]}`)
      } else {
        str_lv = _$('req.group.lv', `${this.lv[0]}~${this.lv[1]}`)
      }
    } else {
      str_lv = _$('req.group.lv', `${this.lv}`)
    }
  } else {
    str_lv = ''
  }
  str_select = this.select ? _$('req.group.select', this.select) : ''
  str_ship = reqstrShip(this.ship, this.amount)
  str_flagship = this.flagship ? _$('req.group.flagship') : ''
  str_note = this.note ? _$('req.group.note', reqstrShip(this.note)) : ''
  return _$('req.group.main', {
    select: str_select,
    ship: str_ship,
    amount: str_amount,
    lv: str_lv,
    flagship: str_flagship,
    note: str_note,
  })
})

const reqstrGroups = (groups) => {
  let group
  return delimJoin(((() => {
    let j
    let len
    let results
    results = []
    for (j = 0, len = groups.length; j < len; j++) {
      group = groups[j]
      results.push(reqstrGroup(group))
    }
    return results
  }))(), _$('req.groups.delim'), _$('req.groups.delim_last'))
}

const reqstrResources = (resources) => {
  let i
  let res_name
  res_name = ['Fuel', 'Ammo', 'Steel', 'Bauxite']
  return delimJoin((((() => {
    let j
    let results
    results = []
    for (i = j = 0; j <= 3; i = ++j) {
      if (resources[i]) {
        results.push(_$('req.simple.resource', {
          name: _$(res_name[i]),
          amount: resources[i],
        }))
      } else {
        results.push(void 0)
      }
    }
    return results
  }))()).filter(str => str != null), _$('req.simple.resource_delim'))
}

const reqstrCategories = []

const reqstr = (requirements) => {
  let category
  let e
  let fn
  let ret
  try {
    category = requirements.category
    fn = reqstrCategories[category]
    ret = fn(requirements)
    return ret
  } catch (error) {
    e = error
    return console.log(`Invalid requirements: ${requirements} reason: ${e} ${e.stack}`)
  }
}

// FORMAT:
// "requirements": {
//   "category": "fleet",
//   "groups": [(group), ...],
//   <"fleetid": 2,>
//   <"disallowed": "其它舰船",>
// }
reqstrCategories.fleet = extractFirstArg(function (detail) {
  let str_disallowed
  let str_fleet
  let str_groups
  str_groups = reqstrGroups(this.groups)
  str_disallowed = this.disallowed ? _$('req.fleet.disallowed', reqstrShip(this.disallowed, 2)) : ''
  str_fleet = this.fleetid ? _$('req.fleet.fleetid', reqstrOrdinalize(this.fleetid)) : ''
  return _$('req.fleet.main', {
    groups: str_groups,
    disallowed: str_disallowed,
    fleet: str_fleet,
  })
})

// FORMAT:
// "requirements": {
//   "category": "sortie",
//   "times": 2,
//   <"map": 2,>
//   <"result": "S" | "A" | "B" | "C" | "クリア" (for 1-6) | undefined,>
//   <"boss": true,>
//   <"groups": [(group), ...]>,
//   <"fleetid": 2,>
//   <"disallowed": "其它舰船" | "正规航母",>
// }
reqstrCategories.sortie = extractFirstArg(function (detail) {
  let str_boss
  let str_disallowed
  let str_fleet
  let str_groups
  let str_map
  let str_result
  let str_times
  str_boss = this.boss ? _$('req.sortie.boss') || '' : _$('req.sortie.!boss') || ''
  str_map = this.map ? _$('req.sortie.map', {
    map: this.map,
    boss: str_boss,
  }) : ''
  str_result = this.result ? _$('req.sortie.result', __(`req.result.${this.result}`)) : _$('req.sortie.!result') || ''
  str_times = _$('req.sortie.times', reqstrFrequency(this.times))
  str_groups = this.groups ? _$('req.sortie.groups', reqstrGroups(this.groups)) : ''
  str_fleet = this.fleetid ? _$('req.sortie.fleet', reqstrOrdinalize(this.fleetid)) : ''
  str_disallowed = this.disallowed ? _$('req.sortie.disallowed', reqstrShip(this.disallowed, 2)) : ''
  return _$('req.sortie.main', {
    map: str_map,
    boss: str_boss,
    result: str_result,
    times: str_times,
    groups: str_groups,
    fleet: str_fleet,
    disallowed: str_disallowed,
  })
})

  // FORMAT:
  // "requirements": {
  //   "category": "sink",
  //   "amount": 2,
  //   "ship": (ship),
  // }

reqstrCategories.sink = extractFirstArg(function (detail) {
  let str_amount
  let str_ship
  str_amount = _$('req.sink.amount', this.amount)
  str_ship = _$('req.sink.ship', reqstrShip(this.ship, this.amount))
  return _$('req.sink.main', {
    amount: str_amount,
    ship: str_ship,
  })
})

  // FORMAT:
  // "requirements": {
  //   "category": "expedition",
  //   <"id": 39 | [37, 38],>
  //   "times": 2,
  //   <"resources": [0, 0, 0, 0],>
  // }

reqstrCategories.expedition = extractFirstArg(function (detail) {
  let object
  let str_id
  let str_name
  let str_times
  return _$('req.expedition.main', {
    objects: (((() => {
      let j
      let len
      let ref
      let results
      ref = detail.objects
      results = []
      for (j = 0, len = ref.length; j < len; j++) {
        object = ref[j]
        str_name = object.id ? (str_id = Array.isArray(object.id) ? object.id.join('/') : object.id, _$('req.expedition.id', str_id)) : _$('req.expedition.any')
        str_times = reqstrFrequency(object.times)
        results.push(_$('req.expedition.object', {
          name: str_name,
          times: str_times,
        }))
      }
      return results
    }))()).join(_$('req.expedition.delim')),
    resources: this.resources ? _$('req.expedition.resources', {
      resources: reqstrResources(this.resources),
    }) : '',
  })
})

reqstrCategories['a-gou'] = () => _$('req.a-gou')

  // FORMAT:
  // "requirements": {
  //   "category": "simple",
  //   "subcategory": "equipment" | "ship" | "scrapequipment" | "scrapship" |
  //                  "modernization" | "improvement" | "resupply" | "repair"
  //   "times": 2,
  //   <other subcategory-specified terms>
  // }
  // DEFINITION FORMAT:
  //   req.simple.SUBCATEGORYNAME = "......%s.......{{{FOO}}}.....{{{BAR}}}"
  //     %s : "times"
  //     {{{FOO}}} : Subcategory-specifed terms
  //   req.simple.SUBCATEGORYNAME_quantifier
  //     [Optional] Used to be pluralized and inserted to %s
  //   req.simple.SUBCATEGORYNAME_FOO
  //     [Optional] Used in place of {{{FOO}}} when FOO=true
  //   req.simple.SUBCATEGORYNAME_!FOO
  //     [Optional] Used in place of {{{FOO}}} when FOO=false
  // Example:
  //     "req.simple.scrapequipment": "Scrap equipment %s{{{batch}}}",
  //     "req.simple.scrapequipment_quantifier": "time",
  //     "req.simple.scrapequipment_batch": " (scrapping together is ok)",
  //   "requirements": {
  //     "category": "simple",
  //     "subcategory": "scrapequipment",
  //     "times": 5,
  //     "batch": true       // Must be present even if false
  //   }
  //   => "Scrap equipment 5 times (scrapping together is ok)"

reqstrCategories.simple = extractFirstArg(function (detail) {
  let basename
  let extra_name
  let extra_str
  let extra_value
  let extras
  let quantifier
  let str_times
  let subcat
  subcat = this.subcategory
  basename = `req.simple.${this.subcategory}`
  quantifier = _$(`${basename}_quantifier`) || ''
  if (!quantifier) {
    str_times = this.times
  } else if (quantifier === 'time') {
    str_times = reqstrFrequency(this.times)
  } else {
    str_times = `${this.times} ${reqstrPluralize(quantifier, this.times)}`
  }
  extras = {}
  for (extra_name in detail) {
    extra_value = detail[extra_name]
    extra_str = extra_value ? _$(`${basename}_${extra_name}`) || '' : _$(`${basename}_!${extra_name}`) || ''
    extras[extra_name] = extra_str
  }
  return _$(`${basename}`, str_times, extras)
})


  // FORMAT:
  // "requirements": {
  //   "category": "excercise",
  //   "times": 2,
  //   <"victory": true,>
  //   <"daily": true,>
  // }
reqstrCategories.excercise = extractFirstArg(function (detail) {
  let quantifier
  let str_daily
  let str_times
  let str_victory
  quantifier = _$('req.excercise.quantifier') || ''
  if (quantifier) {
    str_times = `${this.times} ${reqstrPluralize(quantifier, this.times)}`
  } else {
    str_times = this.times
  }
  str_victory = this.victory ? _$('req.excercise.victory') : ''
  str_daily = this.daily ? _$('req.excercise.daily') : ''
  return _$('req.excercise.main', {
    times: str_times,
    victory: str_victory,
    daily: str_daily,
  })
})

  // FORMAT:
  // "requirements": {
  //   "category": "modelconversion",
  //   <"equipment": "零式艦戦21型(熟練)",>
  //   <"fullyskilled": true,>
  //   <"maxmodified": true,>
  //   <"scraps": [
  //     {"name": "零式艦戦52型", "amount": 2}
  //   ],>
  //   <"consumptions": [
  //     {"name": "勲章", "amount": 2}
  //   ],>
  //   <"secretary": (ship),>    // Default: "a carrier"
  //   <"use_skilled_crew": true>
  // }
reqstrCategories.modelconversion = extractFirstArg(function (detail) {
  let consumption
  let equip
  let scrap
  let str_consumptions
  let str_fullyskilled
  let str_maxmodified
  let str_note
  let str_objects
  let str_scraps
  let str_secretary
  let str_secretary_equip
  str_secretary = this.secretary ? reqstrShip(this.secretary) : _$('req.modelconversion.secretarydefault')
  str_secretary_equip = this.equipment ? (str_fullyskilled = this.fullyskilled ? _$('req.modelconversion.fullyskilled') : '', str_maxmodified = this.maxmodified ? _$('req.modelconversion.maxmodified') : '', _$('req.modelconversion.equip', {
    secretary: str_secretary,
    equipment: Array.isArray(this.equipment) ? ((function () {
      let j
      let len
      let ref
      let results
      ref = this.equipment
      results = []
      for (j = 0, len = ref.length; j < len; j++) {
        equip = ref[j]
        results.push(__(equip))
      }
      return results
    }).call(this)).join(_$('req.modelconversion.equipmentdelim')) : __(this.equipment),
    fullyskilled: str_fullyskilled,
    maxmodified: str_maxmodified,
  })) : _$('req.modelconversion.noequip', {
    secretary: str_secretary,
  })
  str_scraps = this.scraps ? _$('req.modelconversion.scraps', {
    scraps: ((function () {
      let j
      let len
      let ref
      let results
      ref = this.scraps
      results = []
      for (j = 0, len = ref.length; j < len; j++) {
        scrap = ref[j]
        results.push(_$('req.modelconversion.scrap', {
          name: __(scrap.name),
          amount: scrap.amount,
        }))
      }
      return results
    }).call(this)).join(_$('req.modelconversion.scrapdelim')),
  }) : void 0
  str_consumptions = this.consumptions ? _$('req.modelconversion.consumptions', {
    consumptions: ((function () {
      let j
      let len
      let ref
      let results
      ref = this.consumptions
      results = []
      for (j = 0, len = ref.length; j < len; j++) {
        consumption = ref[j]
        results.push(_$('req.modelconversion.consumption', {
          name: __(consumption.name),
          amount: consumption.amount,
        }))
      }
      return results
    }).call(this)).join(_$('req.modelconversion.scrapdelim')),
  }) : void 0
  str_note = this.use_skilled_crew ? _$('req.modelconversion.useskilledcrew') : ''
  str_objects = ([str_scraps, str_consumptions].filter(str => str != null)).join(_$('req.modelconversion.scrapdelim'))
  return _$('req.modelconversion.main', {
    secretary_equip: str_secretary_equip,
    objects: str_objects,
    note: str_note,
  })
})

  // NOTICE:
  //   This is not "Scrap any X piece of equipment". (see "simple")
  //   This is "Scrap XXX, YYY (specific) equipment"
  // FORMAT:
  // "requirements": {
  //   "category": "scrapequipment",
  //   "list": [
  //     {"name": "7.7mm機銃", "amount": 2},
  //   ]
  // }
reqstrCategories.scrapequipment = extractFirstArg(function (detail) {
  let scrap
  let str_scraps
  str_scraps = ((function () {
    let j
    let len
    let ref
    let results
    ref = this.list
    results = []
    for (j = 0, len = ref.length; j < len; j++) {
      scrap = ref[j]
      results.push(_$('req.scrapequipment.scrap', {
        name: __(scrap.name),
        amount: scrap.amount,
      }))
    }
    return results
  }).call(this)).join(_$('req.modelconversion.scrapdelim'))
  return _$('req.scrapequipment.main', {
    scraps: str_scraps,
  })
})

  // FORMAT:
  // "requirements": {
  //   "category": "equipexchange",
  //   <"equipments": [
  //     {"name": "一式陸攻", "amount": 1}
  //   ],>
  //   <"scraps": [
  //     {"name": "零式艦戦21型", "amount": 2}
  //   ],>
  //   <"resources": [油, 弹, 钢, 铝],>
  //   <"consumptions": [
  //     {"name": "勲章", "amount": 2}
  //   ]>
  // }
reqstrCategories.equipexchange = extractFirstArg(function (detail) {
  let consumption
  let equipment
  let scrap
  let str_consumptions
  let str_equipments
  let str_scraps
  str_equipments = this.equipments ? ((function () {
    let j
    let len
    let ref
    let results
    ref = this.equipments
    results = []
    for (j = 0, len = ref.length; j < len; j++) {
      equipment = ref[j]
      results.push(_$('req.equipexchange.equipment', {
        name: __(equipment.name),
        amount: equipment.amount,
      }))
    }
    return results
  }).call(this)).join(_$('req.equipexchange.delim')) : void 0
  str_scraps = this.scraps ? ((function () {
    let j
    let len
    let ref
    let results
    ref = this.scraps
    results = []
    for (j = 0, len = ref.length; j < len; j++) {
      scrap = ref[j]
      results.push(_$('req.equipexchange.scrap', {
        name: __(scrap.name),
        amount: scrap.amount,
      }))
    }
    return results
  }).call(this)).join(_$('req.equipexchange.delim')) : void 0
  str_consumptions = this.resources ? reqstrResources(this.resources) : ''
  str_consumptions += this.consumptions ? ((function () {
    let j
    let len
    let ref
    let results
    ref = this.consumptions
    results = []
    for (j = 0, len = ref.length; j < len; j++) {
      consumption = ref[j]
      results.push(_$('req.equipexchange.consumption', {
        name: __(consumption.name),
        amount: consumption.amount,
      }))
    }
    return results
  }).call(this)).join(_$('req.equipexchange.delim')) : ''
  return _$('req.equipexchange.main', {
    equipments: str_equipments ? _$('req.equipexchange.equipments', {
      equipments: str_equipments,
    }) : '',
    scraps: str_scraps ? _$('req.equipexchange.scraps', {
      scraps: str_scraps,
    }) : '',
    consumptions: str_consumptions ? _$('req.equipexchange.consumptions', {
      consumptions: str_consumptions,
    }) : '',
    delim: str_equipments && str_consumptions ? _$('req.equipexchange.delim') : '',
  })
})

  // FORMAT:
  // "requirements": {
  //   "category": "and",
  //   "list": [
  //     <other_requirement_object>
  //   ]
  // }
reqstrCategories.and = extractFirstArg(function (detail) {
  return this.list.map(reqstr).join(_$('req.and.separator'))
})

  // FORMAT:
  // "requirements": {
  //   "category": "modernization",
  //   "times": 1,
  //   "ship": "Bep",
  //   <"consumptions": [
  //     {"ship": ["cvl", "cv"], "amount": 2}
  //   ]>
  // }
reqstrCategories.modernization = extractFirstArg(function (detail) {
  let consumption
  let str_consumptions
  str_consumptions = this.consumptions ? ((function () {
    let j
    let len
    let ref
    let results
    ref = this.consumptions
    results = []
    for (j = 0, len = ref.length; j < len; j++) {
      consumption = ref[j]
      results.push(_$('req.modernization.consumption', {
        ship: __(consumption.ship),
        amount: consumption.amount,
      }))
    }
    return results
  }).call(this)).join(_$('req.modernization.delim')) : void 0
  return _$('req.modernization.main', {
    ship: this.ship,
    times: reqstrFrequency(this.times),
    consumptions: str_consumptions ? _$('req.modernization.consumptions', {
      consumptions: str_consumptions,
    }) : '',
    resources: this.resources ? _$('req.modernization.resources', {
      resources: reqstrResources(this.resources),
    }) : '',
  })
})

export default (i18n_module_) => {
  i18n_module = i18n_module_
  return reqstr
}
