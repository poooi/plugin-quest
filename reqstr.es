import inflection from 'inflection'
import { mapValues, isArray } from 'lodash'
import { format } from 'util'

const MAX_SHIP_AMOUNT = 6
const MAX_SHIP_LV = 200 // Doesn't matter, usually we use 999. See usage below

let translate = str => str

// This part copied from https://github.com/mashpie/i18n-node with MIT license
// if the msg string contains {{Mustache}} patterns we render it as a mini tempalate
const __ = (str, ...args) => {
  const res = translate(str, ...args, {
    interpolation: {
      escapeValue: false,
    },
  })
  return /%s/.test(res) ? format(res, ...args) : res
}

// Translate: Returns null if not exist. Used for format controller
const _$ = (str, ...args) => {
  const res = translate(str, ...args, {
    defaultValue: null,
    interpolation: {
      escapeValue: false,
    },
  })
  return /%s/.test(res) ? format(res, ...args) : res
}

const parsePluralize = (str, amount) => {
  if (!_$('req.option.pluralize') || !amount) {
    return str
  }
  return inflection.inflect(str, amount)
}

const parseFrequency = times => {
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

const parseOrdinalize = num => {
  if (!_$('req.option.ordinalize')) {
    return num
  }
  return inflection.ordinalize(`${num}`)
}

const parseShip = (ship, _amount) => {
  let shipStr
  if (typeof ship === 'string') {
    shipStr = __(ship)
  } else if (Array.isArray(ship)) {
    shipStr = ship.map(_ship => parseShip(_ship)).join('/')
  }
  const amount = Array.isArray(_amount) ? _amount[_amount.length - 1] : _amount
  return parsePluralize(shipStr, amount)
}

const parseShipClass = (shipClass, _amount) => {
  let shipClassStr
  if (typeof shipClass === 'string') {
    shipClassStr = _$('req.group.class', __(shipClass))
  } else if (Array.isArray(shipClass)) {
    shipClassStr = shipClass
      .map(_shipClass => parseShipClass(_shipClass))
      .join('/')
  }
  const amount = Array.isArray(_amount) ? _amount[_amount.length - 1] : _amount
  return parsePluralize(shipClassStr, amount)
}

const delimJoin = (strs, delim, last) => {
  if (typeof last === 'undefined' || last === null || strs.length <= 1) {
    return strs.join(delim)
  }
  return strs.slice(0, -1).join(delim) + last + strs[strs.length - 1]
}

//     {
//       "ship":  "晓" | ["空母", "轻母", "水母"],
//       <"amount": 1 | [1, 3] | [3, 3] | [3, 6],>  // 6 == 'inf'
//       <"flagship": true,>
//       <"note": "轻母",>
//       <"select": 5,>    // "any 5 of xxx/xxx ships"
//       <"lv": 99 | [95, 99] | [100, 999],>   // 999 == 'inf'
//     }, ...
const parseGroup = group => {
  let amount = ''
  if (group.amount) {
    if (Array.isArray(group.amount)) {
      if (group.amount[0] === group.amount[1]) {
        amount = _$('req.group.amountonly', `${group.amount[0]}`)
      } else if (group.amount[1] >= MAX_SHIP_AMOUNT) {
        amount = _$('req.group.amountmore', `${group.amount[0]}`)
      } else {
        amount = _$('req.group.amount', `${group.amount[0]}~${group.amount[1]}`)
      }
    } else {
      amount = _$('req.group.amount', `${group.amount}`)
    }
  }

  let lv = ''
  if (group.lv) {
    if (Array.isArray(group.lv)) {
      if (group.lv[1] >= MAX_SHIP_LV) {
        lv = _$('req.group.lvmore', `${group.lv[0]}`)
      } else {
        lv = _$('req.group.lv', `${group.lv[0]}~${group.lv[1]}`)
      }
    } else {
      lv = _$('req.group.lv', `${group.lv}`)
    }
  }

  const select = group.select ? _$('req.group.select', group.select) : ''
  const ship = group.shipclass
    ? parseShipClass(group.shipclass, group.amount)
    : parseShip(group.ship, group.amount)
  const flagship = group.flagship ? _$('req.group.flagship') : ''
  const note = group.note ? _$('req.group.note', parseShip(group.note)) : ''
  return _$('req.group.main', {
    select,
    ship,
    amount,
    lv,
    flagship,
    note,
  })
}

const parseGroups = groups =>
  delimJoin(
    groups.map(parseGroup),
    _$('req.groups.delim'),
    _$('req.groups.delim_last'),
  )

const parseResources = resources => {
  const name = ['Fuel', 'Ammo', 'Steel', 'Bauxite']
  return delimJoin(
    resources
      .map(
        (resource, i) =>
          resource
            ? _$('req.simple.resource', {
                name: __(name[i]),
                amount: resource,
              })
            : null,
      )
      .filter(str => str != null),
    _$('req.simple.resource_delim'),
  )
}

// const reqstrCategories = {}
const parseRequirement = requirements => {
  try {
    const { category } = requirements
    const req = new Requirement(requirements) // eslint-disable-line no-use-before-define
    const result = req[category]
    return result
  } catch (e) {
    return console.log(
      `Invalid requirements: ${requirements} reason: ${e} ${e.stack}`,
    )
  }
}

const parseSlotEuipment = (
  secretary,
  { slot = 0, equipment, maxmodified, fullyskilled },
) =>
  isArray(equipment)
    ? equipment
        .map(eq =>
          parseSlotEuipment(secretary, {
            slot,
            equipment: eq,
            maxmodified,
            fullyskilled,
          }),
        )
        .join(_$('req.and.word'))
    : _$('req.modelconversion.equip', {
        secretary,
        slot: _$(`req.modelconversion.slot.${slot}`),
        equipment: __(equipment),
        fullyskilled: fullyskilled
          ? _$('req.modelconversion.fullyskilled')
          : '',
        maxmodified: maxmodified ? _$('req.modelconversion.maxmodified') : '',
      })

class Requirement {
  constructor(requirement) {
    Object.assign(this, requirement)
    this.detail = requirement
  }

  // FORMAT:
  // "requirements": {
  //   "category": "fleet",
  //   "groups": [(group), ...],
  //   <"fleetid": 2,>
  //   <"disallowed": "其它舰船",>
  // }
  get fleet() {
    const groups = parseGroups(this.groups)
    const disallowed = this.disallowed
      ? _$('req.fleet.disallowed', parseShip(this.disallowed, 2))
      : ''
    const fleet = this.fleetid
      ? _$('req.fleet.fleetid', parseOrdinalize(this.fleetid))
      : ''
    return _$('req.fleet.main', {
      groups,
      disallowed,
      fleet,
    })
  }

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
  get sortie() {
    const boss = this.boss
      ? _$('req.sortie.boss') || ''
      : _$('req.sortie.!boss') || ''
    const map = this.map
      ? _$('req.sortie.map', {
          map: this.map,
          boss,
        })
      : ''
    const result = this.result
      ? _$('req.sortie.result', __(`req.result.${this.result}`))
      : _$('req.sortie.!result') || ''
    const times = _$('req.sortie.times', parseFrequency(this.times))
    const groups = this.groups
      ? _$('req.sortie.groups', parseGroups(this.groups))
      : ''
    const fleet = this.fleetid
      ? _$('req.sortie.fleet', parseOrdinalize(this.fleetid))
      : ''
    const disallowed = this.disallowed
      ? _$('req.sortie.disallowed', parseShip(this.disallowed, 2))
      : ''
    return _$('req.sortie.main', {
      map,
      boss,
      result,
      times,
      groups,
      fleet,
      disallowed,
    })
  }

  // FORMAT:
  // "requirements": {
  //   "category": "sink",
  //   "amount": 2,
  //   "ship": (ship),
  // }
  get sink() {
    const amount = _$('req.sink.amount', this.amount)
    const ship = _$('req.sink.ship', parseShip(this.ship, this.amount))
    return _$('req.sink.main', {
      amount,
      ship,
    })
  }

  // FORMAT:
  // "requirements": {
  //   "category": "expedition",
  //   <"id": 39 | [37, 38],>
  //   "times": 2,
  //   <"resources": [0, 0, 0, 0],>
  //   <"groups": [(group), ...],>
  //   <"disallowed": "其它舰船",>
  // }
  get expedition() {
    const objects = this.objects
      .map(object => {
        let name
        if (object.id) {
          const id = Array.isArray(object.id) ? object.id.join('/') : object.id
          name = _$('req.expedition.id', id)
        } else {
          name = _$('req.expedition.any')
        }
        const times = parseFrequency(object.times)
        return _$('req.expedition.object', {
          name,
          times,
        })
      })
      .join(_$('req.expedition.delim'))

    const resources = this.resources
      ? _$('req.expedition.resources', {
          resources: parseResources(this.resources),
        })
      : ''

    const groups = this.groups
      ? _$('req.expedition.groups', parseGroups(this.groups))
      : ''
    const disallowed = this.disallowed
      ? _$('req.expedition.disallowed', parseShip(this.disallowed, 2))
      : ''

    return _$('req.expedition.main', {
      objects,
      resources,
      groups,
      disallowed,
    })
  }

  /* eslint-disable class-methods-use-this */
  get ['a-gou']() {
    return _$('req.a-gou')
  }
  /* eslint-enable class-methods-use-this */

  // FORMAT:
  // "requirements": {
  //   "category": "simple",
  //   "subcategory": "equipment" | "ship" | "scrapequipment" | "scrapship" |
  //                  "modernization" | "improvement" | "resupply" | "repair"
  //   "times": 2,
  //   <other subcategory-specified terms>
  // }
  // DEFINITION FORMAT:
  //   req.simple.SUBCATEGORYNAME = "......%s.......{{FOO}}.....{{BAR}}"
  //     %s : "times"
  //     {{FOO}} : Subcategory-specifed terms
  //   req.simple.SUBCATEGORYNAME_quantifier
  //     [Optional] Used to be pluralized and inserted to %s
  //   req.simple.SUBCATEGORYNAME_FOO
  //     [Optional] Used in place of {{FOO}} when FOO=true
  //   req.simple.SUBCATEGORYNAME_!FOO
  //     [Optional] Used in place of {{FOO}} when FOO=false
  // Example:
  //     "req.simple.scrapequipment": "Scrap equipment %s{{batch}}",
  //     "req.simple.scrapequipment_quantifier": "time",
  //     "req.simple.scrapequipment_batch": " (scrapping together is ok)",
  //   "requirements": {
  //     "category": "simple",
  //     "subcategory": "scrapequipment",
  //     "times": 5,
  //     "batch": true       // Must be present even if false
  //   }
  //   => "Scrap equipment 5 times (scrapping together is ok)"
  get simple() {
    const basename = `req.simple.${this.subcategory}`
    const quantifier = _$(`${basename}_quantifier`) || ''
    let times
    if (!quantifier) {
      ;({ times } = this)
    } else if (quantifier === 'time') {
      times = parseFrequency(this.times)
    } else {
      times = `${this.times} ${parsePluralize(quantifier, this.times)}`
    }
    const extras = mapValues(
      this.detail,
      (value, name) =>
        value
          ? _$(`${basename}_${name}`) || ''
          : _$(`${basename}_!${name}`) || '',
    )
    return _$(`${basename}`, { ...extras, times })
  }

  // FORMAT:
  // "requirements": {
  //   "category": "excercise",
  //   "times": 2,
  //   <"victory": true,>
  //   <"daily": true,>
  // }
  get excercise() {
    const quantifier = _$('req.excercise.quantifier') || ''
    const groups = this.groups
      ? _$('req.excercise.groups', parseGroups(this.groups))
      : ''
    let times
    if (quantifier) {
      times = `${this.times} ${parsePluralize(quantifier, this.times)}`
    } else {
      ;({ times } = this)
    }
    const victory = this.victory ? _$('req.excercise.victory') : ''
    const daily = this.daily ? _$('req.excercise.daily') : ''
    return _$('req.excercise.main', {
      times,
      victory,
      daily,
      groups,
    })
  }

  // FORMAT:
  // "requirements": {
  //   "category": "modelconversion",
  //   <"slots": [
  //     {"
  //        slot": 1,
  //        "equipment": "零式艦戦21型(熟練)",
  //        <"fullyskilled": true,>,
  //        <"maxmodified": true,>,
  //        <"count": 1>}
  //  ],>
  //   <"equipment": ["零式艦戦21型(熟練)", "零式艦戦21型(熟練)"]>
  //   <"fullyskilled": true,>
  //   <"maxmodified": true,>
  //   <"scraps": [
  //     {"name": "零式艦戦52型", "amount": 2}
  //   ],>
  //   <"consumptions": [
  //     {"name": "勲章", "amount": 2}
  //   ],>
  //   <"resources": [0, 0, 0, 0],>
  //   <"secretary": (ship),>    // Default: "a carrier"
  //   <"use_skilled_crew": true>
  // }
  get modelconversion() {
    const secretary = this.secretary
      ? parseShip(this.secretary)
      : _$('req.modelconversion.secretarydefault')
    let secretaryEquip
    if (this.slots) {
      secretaryEquip = this.slots
        .map(equip => parseSlotEuipment(secretary, equip))
        .join(_$('req.and.word'))
    } else if (this.equipment) {
      secretaryEquip = parseSlotEuipment(secretary, this)
    } else {
      secretaryEquip = _$('req.modelconversion.noequip', {
        secretary,
      })
    }

    const scraps = this.scraps
      ? _$('req.modelconversion.scraps', {
          scraps: this.scraps
            .map(scrap =>
              _$('req.modelconversion.scrap', {
                name: __(scrap.name),
                amount: scrap.amount,
              }),
            )
            .join(_$('req.modelconversion.scrapdelim')),
        })
      : null

    const consumptions =
      this.consumptions || this.resources
        ? _$('req.modelconversion.consumptions', {
            consumptions: [
              ...(this.consumptions
                ? this.consumptions.map(consumption =>
                    _$('req.modelconversion.consumption', {
                      name: __(consumption.name),
                      amount: consumption.amount,
                    }),
                  )
                : []),
              this.resources && parseResources(this.resources),
            ]
              .filter(str => str != null)
              .join(_$('req.modelconversion.scrapdelim')),
          })
        : null

    const note = this.use_skilled_crew
      ? _$('req.modelconversion.useskilledcrew')
      : ''
    const objects = [scraps, consumptions]
      .filter(str => str != null)
      .join(_$('req.modelconversion.scrapdelim'))
    if (!objects && !note) {
      return _$('req.modelconversion.noextra', {
        secretary_equip: secretaryEquip,
      })
    }
    return _$('req.modelconversion.main', {
      secretary_equip: secretaryEquip,
      objects,
      note,
    })
  }

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
  get scrapequipment() {
    const scraps = this.list
      .map(scrap =>
        _$('req.scrapequipment.scrap', {
          name: __(scrap.name),
          amount: scrap.amount,
        }),
      )
      .join(_$('req.modelconversion.scrapdelim'))
    return _$('req.scrapequipment.main', {
      scraps,
    })
  }

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
  get equipexchange() {
    const equipments = this.equipments
      ? this.equipments
          .map(equipment =>
            _$('req.equipexchange.equipment', {
              name: __(equipment.name),
              amount: equipment.amount,
            }),
          )
          .join(_$('req.equipexchange.delim'))
      : null

    const scraps = this.scraps
      ? this.scraps
          .map(scrap =>
            _$('req.equipexchange.scrap', {
              name: __(scrap.name),
              amount: scrap.amount,
            }),
          )
          .join(_$('req.equipexchange.delim'))
      : null

    let consumptions = this.resources ? parseResources(this.resources) : ''
    consumptions += this.consumptions
      ? this.consumptions
          .map(consumption =>
            _$('req.equipexchange.consumption', {
              name: __(consumption.name),
              amount: consumption.amount,
            }),
          )
          .join(_$('req.equipexchange.delim'))
      : ''

    return _$('req.equipexchange.main', {
      equipments: equipments
        ? _$('req.equipexchange.equipments', {
            equipments,
          })
        : '',
      scraps: scraps
        ? _$('req.equipexchange.scraps', {
            scraps,
          })
        : '',
      consumptions: consumptions
        ? _$('req.equipexchange.consumptions', {
            consumptions,
          })
        : '',
      delim: equipments && consumptions ? _$('req.equipexchange.delim') : '',
    })
  }

  // FORMAT:
  // "requirements": {
  //   "category": "and",
  //   "list": [
  //     <other_requirement_object>
  //   ]
  // }
  get and() {
    return this.list.map(parseRequirement).join(_$('req.and.separator'))
  }

  get then() {
    return this.list.map(parseRequirement).join(_$('req.then.separator'))
  }

  // FORMAT:
  // "requirements": {
  //   "category": "modernization",
  //   "times": 1,
  //   "ship": "Bep",
  //   <"consumptions": [
  //     {"ship": ["cvl", "cv"], "amount": 2}
  //   ]>
  // }
  get modernization() {
    const consumptions = this.consumptions
      ? this.consumptions
          .map(consumption =>
            _$('req.modernization.consumption', {
              ship: __(consumption.ship),
              amount: consumption.amount,
            }),
          )
          .join(_$('req.modernization.delim'))
      : null
    return _$('req.modernization.main', {
      ship: this.ship,
      times: parseFrequency(this.times),
      consumptions: consumptions
        ? _$('req.modernization.consumptions', {
            consumptions,
          })
        : '',
      resources: this.resources
        ? _$('req.modernization.resources', {
            resources: parseResources(this.resources),
          })
        : '',
    })
  }
}

export default _translate => {
  translate = _translate
  return parseRequirement
}
