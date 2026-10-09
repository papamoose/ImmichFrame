<script lang="ts">
	import { untrack } from 'svelte';
	import type { AnyFieldDef } from './admin-fields';
	import {
		Checkbox,
		Field,
		HelperText,
		Icon,
		Input,
		Label,
		NumberInput,
		PasswordInput,
		Select,
		Text,
		Textarea
	} from '@immich/ui';
	import { mdiStar, mdiStarOutline } from '@mdi/js';

	interface Props {
		field: AnyFieldDef;
		target: Record<string, unknown>;
	}

	let { field, target }: Props = $props();

	const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

	// Deliberately captures the initial value only; the parent remounts on settings reload.
	// A $derived would re-split on every keystroke and swallow blank lines as you type,
	// so the read is untracked rather than reactive.
	// Guarded with Array.isArray because this line runs for every field type, not just lists.
	let listText = $state(
		untrack(() =>
			Array.isArray(target[field.key]) ? (target[field.key] as string[]).join('\n') : ''
		)
	);

	let invalidGuids: string[] = $state([]);

	let textValue = $derived((target[field.key] as string | null) ?? '');
	let dateValue = $derived(textValue.substring(0, 10));

	// Minimum star rating: 1-5, or null/0 for "any". Tapping the picked star again clears it.
	let rating = $derived((target[field.key] as number | null) ?? 0);

	function pickRating(stars: number) {
		target[field.key] = rating === stars ? null : stars;
	}

	function updateList(text: string) {
		listText = text;
		const lines = text
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		if (field.type === 'guid-list') {
			invalidGuids = lines.filter((line) => !guidPattern.test(line));
		}
		target[field.key] = lines;
	}

	function updateDate(raw: string) {
		target[field.key] = raw === '' ? null : new Date(raw).toISOString();
	}
</script>

{#if field.type === 'checkbox'}
	<!-- Label sits to the right of the box; the wrapping <label> makes the text toggle only this box. -->
	<label class="flex cursor-pointer items-center gap-3 py-1">
		<Checkbox
			checked={target[field.key] === true}
			onCheckedChange={(checked) => (target[field.key] = checked)}
		/>
		<span>{field.label}</span>
	</label>
	{#if field.help}
		<HelperText>{field.help}</HelperText>
	{/if}
{:else}
	<Field label={field.label} invalid={invalidGuids.length > 0}>
		{#if field.type === 'select'}
			<Select options={field.options ?? []} bind:value={target[field.key] as string} />
		{:else if field.type === 'number'}
			<NumberInput
				bind:value={target[field.key] as number}
				step={field.step ?? '1'}
				min={field.min}
				max={field.max}
			/>
		{:else if field.type === 'rating'}
			<!-- Field only draws its label for real inputs, so the label is drawn here -->
			<Label label={field.label} size="small" class="text-dark" />
			<div class="flex items-center gap-1" role="radiogroup" aria-label={field.label}>
				{#each [1, 2, 3, 4, 5] as stars (stars)}
					<button
						type="button"
						role="radio"
						aria-checked={rating === stars}
						aria-label="{stars} {stars === 1 ? 'star' : 'stars'} or more"
						class="rounded-md p-1 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary {stars <=
						rating
							? 'text-amber-400'
							: 'text-gray-400'}"
						onclick={() => pickRating(stars)}
					>
						<Icon icon={stars <= rating ? mdiStar : mdiStarOutline} size="32" />
					</button>
				{/each}
				<Text color="muted" size="small" class="ml-3">
					{rating ? `${rating}+ stars` : 'Any rating'}
				</Text>
			</div>
		{:else if field.type === 'password'}
			<PasswordInput
				autocomplete="off"
				value={textValue}
				oninput={(e) => (target[field.key] = e.currentTarget.value)}
			/>
		{:else if field.type === 'date'}
			<Input type="date" value={dateValue} oninput={(e) => updateDate(e.currentTarget.value)} />
		{:else if field.type === 'list' || field.type === 'guid-list'}
			<Textarea rows={3} value={listText} oninput={(e) => updateList(e.currentTarget.value)} />
		{:else}
			<Input
				placeholder={field.placeholder ?? ''}
				value={textValue}
				oninput={(e) => (target[field.key] = e.currentTarget.value)}
			/>
		{/if}

		{#if invalidGuids.length}
			<HelperText color="danger">Not a valid ID: {invalidGuids.join(', ')}</HelperText>
		{:else if field.help}
			<HelperText>{field.help}</HelperText>
		{/if}
	</Field>
{/if}
