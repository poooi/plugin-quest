import { join } from 'path'
import { mapValues } from 'lodash'
import { readQuestInfo } from '../redux'

window.LOCALES = [
  {
    locale: 'zh-CN',
    lng: '简体中文',
  },
  {
    locale: 'zh-TW',
    lng: '正體中文',
  },
  {
    locale: 'ja-JP',
    lng: '日本語',
  },
  {
    locale: 'en-US',
    lng: 'English',
  },
  {
    locale: 'ko-KR',
    lng: '한국어',
  },
]

beforeEach(() => {})

describe('readQuestInfo', () => {
  test.each(window.LOCALES.map(l => l.locale))(
    '%s should match snapshot',
    async lng => {
      window.language = lng
      const dataPath = join('assets', 'data.json')

      const dispatchMock = jest.fn(({ quests }) => {
        expect(
          mapValues(
            quests,
            // eslint-disable-next-line camelcase
            ({ condition, detail, game_id, name, postquest }) => ({
              condition,
              detail,
              game_id,
              name,
              postquest,
            }),
          ),
        ).toMatchSnapshot()
      })
      await readQuestInfo(dataPath)(dispatchMock)
      expect(dispatchMock).toBeCalledTimes(1)
    },
  )
})
