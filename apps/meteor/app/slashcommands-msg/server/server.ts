import { Meteor } from 'meteor/meteor';
import { Random } from '@rocket.chat/random';
import { TAPi18n } from 'meteor/rocketchat:tap-i18n';
import { api } from '@rocket.chat/core-services';
import { Users } from '@rocket.chat/models';
import type { SlashCommandCallbackParams } from '@rocket.chat/core-typings';

import { slashCommands } from '../../utils/lib/slashCommand';
import { settings } from '../../settings/server';
import { executeSendMessage } from '../../lib/server/methods/sendMessage';

/*
 * Msg is a named function that will replace /msg commands
 */

slashCommands.add({
	command: 'msg',
	callback: async function Msg({ params, message: item, userId }: SlashCommandCallbackParams<'msg'>): Promise<void> {
		const trimmedParams = params.trim();
		const separator = trimmedParams.indexOf(' ');
		if (separator === -1) {
			void api.broadcast('notify.ephemeralMessage', userId, item.rid, {
				msg: TAPi18n.__('Username_and_message_must_not_be_empty', { lng: settings.get('Language') || 'en' }),
			});
			return;
		}
		const message = trimmedParams.slice(separator + 1);
		const targetUsernameOrig = trimmedParams.slice(0, separator);
		const targetUsername = targetUsernameOrig.replace('@', '');
		const targetUser = await Users.findOneByUsernameIgnoringCase(targetUsername);
		if (targetUser == null) {
			const user = await Users.findOneById(userId, { projection: { language: 1 } });
			void api.broadcast('notify.ephemeralMessage', userId, item.rid, {
				msg: TAPi18n.__('Username_doesnt_exist', {
					postProcess: 'sprintf',
					sprintf: [targetUsernameOrig],
					lng: user?.language || settings.get('Language') || 'en',
				}),
			});
			return;
		}
		const { rid } = await Meteor.callAsync('createDirectMessage', targetUsername);
		const msgObject = {
			_id: Random.id(),
			rid,
			msg: message,
		};
		await executeSendMessage(userId, msgObject);
	},
	options: {
		description: 'Direct_message_someone',
		params: '@username <message>',
		permission: 'create-d',
	},
});
