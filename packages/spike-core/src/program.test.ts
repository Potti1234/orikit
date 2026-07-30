import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  assertCommandCompletion,
  CommandContractError,
  codecsFor,
  defineCommandContract,
  defineProgram,
  tagged,
  transition,
} from './index'

const Flags = Schema.Struct({ start: Schema.Number })
const Model = Schema.Struct({ count: Schema.Number })
const Message = Schema.Union([
  Schema.TaggedStruct('Incremented', {}),
  Schema.TaggedStruct('Completed', {}),
  Schema.TaggedStruct('Failed', { reason: Schema.String }),
])
const Command = Schema.TaggedStruct('Persist', { count: Schema.Number })

type Flags = typeof Flags.Type
type Model = typeof Model.Type
type Message = typeof Message.Type
type Command = typeof Command.Type

const contract = defineCommandContract<Command, Message>({
  Persist: ['Completed', 'Failed'],
})

const program = defineProgram<Flags, Model, Message, Command>({
  identity: { name: 'program-test', schemaVersion: 1, buildVersion: 'test' },
  Flags,
  Model,
  Message,
  Command,
  commandContract: contract,
  init: ({ start }) => transition({ count: start }),
  update: (model, message) =>
    message._tag === 'Incremented'
      ? transition({ count: model.count + 1 }, tagged('Persist', { count: model.count + 1 }))
      : transition(model),
})

describe('portable Program boundary', () => {
  it('decodes and encodes every public boundary', () => {
    const codecs = codecsFor(program)
    expect(codecs.decodeFlags({ start: 2 })).toEqual({ start: 2 })
    expect(codecs.decodeModel({ count: 3 })).toEqual({ count: 3 })
    expect(codecs.decodeMessage({ _tag: 'Incremented' })).toEqual({ _tag: 'Incremented' })
    expect(codecs.decodeCommand({ _tag: 'Persist', count: 4 })).toEqual({
      _tag: 'Persist',
      count: 4,
    })
  })

  it('rejects invalid messages and commands at runtime', () => {
    const codecs = codecsFor(program)
    expect(() => codecs.decodeMessage({ _tag: 'Unknown' })).toThrow()
    expect(() => codecs.decodeCommand({ _tag: 'Persist', count: 'four' })).toThrow()
  })

  it('constructs frozen serializable tagged descriptions', () => {
    const command = tagged('Persist', { count: 4 })
    expect(command).toEqual({ _tag: 'Persist', count: 4 })
    expect(Object.isFrozen(command)).toBe(true)
    expect(JSON.stringify(command)).toBe('{"_tag":"Persist","count":4}')
  })

  it('accepts only completion messages declared by the command contract', () => {
    expect(() =>
      assertCommandCompletion(contract, tagged('Persist', { count: 1 }), tagged('Completed')),
    ).not.toThrow()
    expect(() =>
      assertCommandCompletion(contract, tagged('Persist', { count: 1 }), tagged('Incremented')),
    ).toThrow(CommandContractError)
  })

  it('validates program identity when defining the program', () => {
    expect(() =>
      defineProgram({
        ...program,
        identity: { name: 'bad', schemaVersion: Number.NaN, buildVersion: 'test' },
      }),
    ).toThrow()
  })
})
