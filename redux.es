import { forEach, range, get, mapValues } from 'lodash'

import { copyIfSame } from 'views/utils/tools'
import { QuestHelper, questDataMap } from 'kcwiki-quest-data'

const initState = {
  quests: {},
  questStatus: {},
}

/* questStatus
 */
const [COMPLETED, AVAILABLE, UNAVAILABLE] = range(1, 4)

const typeFreqs = [0, 1, 6, 4, 5, 5, 3, 2]

// Will modify `status`
function updateQuestStatus(quests, qid, status) {
  const quest = quests[qid]
  if (!quest) {
    return
  }
  quest.postquest.forEach(pid => {
    const postq = quests[pid]
    if (!postq) {
      return
    }
    if (
      typeFreqs[quest.type] <= typeFreqs[postq.type] &&
      status[postq.game_id] !== UNAVAILABLE
    ) {
      status[postq.game_id] = UNAVAILABLE // eslint-disable-line no-param-reassign
      updateQuestStatus(quests, postq.game_id, status)
    }
  })
}

export function reducer(state = initState, action) {
  const { type, body, postBody } = action
  switch (type) {
    case '@@poi-plugin-quest-info@init': {
      const { quests, questStatus } = action
      return {
        ...state,
        quests,
        questStatus,
      }
    }

    case '@@Response/kcsapi/api_get_member/questlist': {
      let { questStatus } = state
      const { quests } = state
      const statusBackup = questStatus
      forEach(body.api_list, quest => {
        // `quest` may be -1
        if (!quest || typeof quest !== 'object') {
          return
        }
        if (state.questStatus[quest.api_no] !== AVAILABLE) {
          questStatus = copyIfSame(questStatus, statusBackup)
          questStatus[quest.api_no] = AVAILABLE
          updateQuestStatus(quests, quest.api_no, questStatus)
        }
      })
      if (questStatus !== statusBackup) {
        return {
          ...state,
          questStatus,
        }
      }
      break
    }

    case '@@Response/kcsapi/api_req_quest/clearitemget': {
      const qid = parseInt(postBody.api_quest_id, 10)
      const { quests } = state
      const questStatus = { ...state.questStatus }
      questStatus[qid] = 1
      get(quests, [qid, 'postquest'], []).forEach(postq => {
        if (questStatus[postq] !== UNAVAILABLE) {
          return
        }
        const clearflag = get(quests, [postq, 'prerequisite'], []).every(
          prereq => questStatus[prereq] === COMPLETED,
        )
        if (clearflag) {
          questStatus[postq] = AVAILABLE
        }
      })
      return {
        ...state,
        questStatus,
      }
    }
    default:
  }
  return state
}

export const readQuestInfo = () => async dispatch => {
  const quests = questDataMap
  forEach(quests, quest => {
    // Initialize `quests`
    const questHelper = QuestHelper.of(quest)
    quest.condition = questHelper.translate(window.language) // eslint-disable-line no-param-reassign
    // TODO postquest should handled when build
    quest.postquest = questHelper.getPostQuest().map(q => q.unwrap().game_id) // eslint-disable-line no-param-reassign
  })
  // Initialize `questStatus`
  const questStatus = mapValues(quests, () => COMPLETED)

  dispatch({
    type: '@@poi-plugin-quest-info@init',
    quests,
    questStatus,
  })
}
