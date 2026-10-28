// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrillLibrary } from './DrillLibrary.jsx';
import { createCoachFeedbackSheet } from './RankingReview.jsx';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('DrillLibrary', () => {
  it('combines guide and age filters and resets the guide along with other filters', () => {
    render(<DrillLibrary />);
    fireEvent.change(screen.getByLabelText('Training guide'), { target: { value: 'Barrel Quest' } });
    expect(screen.getByRole('heading', { name: 'Gap-gate delivery' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Quiet glove grounders' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Player age'), { target: { value: '11' } });
    expect(screen.getByText(/No drills match/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(screen.getByLabelText('Training guide').value).toBe('');
    expect(screen.getByRole('heading', { name: 'Quiet glove grounders' })).toBeTruthy();
  });
  it('shows child-choice guidance, original attribution, and paper-only home instructions', () => {
    render(<DrillLibrary />);
    fireEvent.click(screen.getByRole('button', { name: 'At home' }));
    fireEvent.click(screen.getByText('A simple way to play at home'));
    expect(screen.getByText(/Misses never erase successes/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search drills'), { target: { value: 'traffic-light' } });
    fireEvent.click(screen.getByText('My home challenge'));
    expect(screen.getByText('Red and green paper cards; empty hands only')).toBeTruthy();
    expect(screen.getByText(/Quest 3A - Traffic-Light Hitter/)).toBeTruthy();
    expect(screen.getByText(/Use empty hands only. An adult checks/)).toBeTruthy();
    expect(screen.queryByText(/Wear a helmet/)).toBeNull();
  });
  it('filters home practice to solo household challenges and makes instructions accessible', () => {
    render(<DrillLibrary />);
    fireEvent.click(screen.getByRole('button', { name: 'At home' }));
    fireEvent.click(screen.getByLabelText('No partner needed'));
    fireEvent.click(screen.getByLabelText('No throwing'));
    fireEvent.change(screen.getByLabelText('Search drills'), { target: { value: 'swing statue' } });
    expect(screen.getByRole('heading', { name: 'Swing statue rehearsal' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Short target throws' })).toBeNull();
    expect(screen.getByText('None; empty hands only')).toBeTruthy();
    fireEvent.click(screen.getByText('My home challenge'));
    expect(screen.getByText('Pretend to swing slowly.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Review for practice' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Download home card' })).toBeTruthy();
  });
  it('requires a deliberate division confirmation for bunting and shows no-home drills only at practice', () => {
    render(<DrillLibrary />);
    fireEvent.change(screen.getByLabelText('Search drills'), { target: { value: 'bunt' } });
    expect(screen.getByText(/No drills match/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('I confirmed this division permits bunting'));
    expect(screen.getByRole('heading', { name: 'Bunt lane choice' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'At home' }));
    expect(screen.queryByRole('heading', { name: 'Bunt lane choice' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Soft bunt targets' })).toBeTruthy();
  });
  it('passes instructions for review and gates the private ranking discussion', () => {
    const select = vi.fn(); const { rerender } = render(<DrillLibrary onSelect={select} canReviewRanking />);
    const card = screen.getByRole('heading', { name: 'Quiet glove grounders' }).closest('article');
    fireEvent.click(within(card).getByRole('button', { name: 'Review for practice' }));
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'quiet-glove', steps: expect.any(Array) }));
    fireEvent.click(screen.getByText('Review the ranking system & gather coach feedback'));
    expect(screen.getByRole('region', { name: 'Ranking system review' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download coach feedback worksheet' })).toBeTruthy();
    rerender(<DrillLibrary />);
    expect(screen.queryByRole('region', { name: 'Ranking system review' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Review for practice' })).toBeNull();
  });
  it('downloads the selected home instructions as a plain text handout', () => {
    const create = vi.fn(() => 'blob:home-card');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<DrillLibrary />);
    fireEvent.change(screen.getByLabelText('Search drills'), { target: { value: 'field, gather' } });
    fireEvent.click(screen.getByRole('button', { name: 'Download home card' }));
    expect(create).toHaveBeenCalledWith(expect.any(Blob));
    expect(click.mock.instances[0].download).toBe('diamond-live-field-gather-home.txt');
    expect(click.mock.instances[0].href).toBe('blob:home-card');
    expect(createCoachFeedbackSheet()).toContain('Bunting is required');
  });
});
