// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage.jsx';

afterEach(cleanup);

describe('public homepage', () => {
  it('keeps sign-in and demo actions distinct at every entry point', () => {
    const onSignIn = vi.fn();
    const onExploreDemo = vi.fn();
    render(<HomePage onSignIn={onSignIn} onExploreDemo={onExploreDemo} />);

    const accountActions = screen.getAllByRole('button', { name: /^(Start your team|Sign in)$/ });
    accountActions.forEach((button) => fireEvent.click(button));
    expect(onSignIn).toHaveBeenCalledTimes(accountActions.length);
    expect(onExploreDemo).not.toHaveBeenCalled();

    const demoActions = screen.getAllByRole('button', { name: /^(Explore the demo|Explore before signing in|Try it in the demo)$/ });
    demoActions.forEach((button) => fireEvent.click(button));
    expect(onExploreDemo).toHaveBeenCalledTimes(demoActions.length);
    expect(onSignIn).toHaveBeenCalledTimes(accountActions.length);
  });

  it('lets keyboard users explore each feature with one selected tab and a matching panel', () => {
    render(<HomePage onSignIn={vi.fn()} onExploreDemo={vi.fn()} />);
    const tabs = screen.getAllByRole('tab');

    function expectSelection(index, heading) {
      expect(screen.getAllByRole('tab', { selected: true })).toEqual([tabs[index]]);
      const panel = screen.getByRole('tabpanel');
      expect(tabs[index].getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.getAttribute('aria-labelledby')).toBe(tabs[index].id);
      expect(within(panel).getByRole('heading', { name: heading })).toBeTruthy();
      tabs.forEach((tab, tabIndex) => expect(tab.tabIndex).toBe(tabIndex === index ? 0 : -1));
    }

    expectSelection(0, 'A good week starts here.');
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: 'ArrowDown' });
    expectSelection(1, 'Notice it. Work on it.');
    expect(document.activeElement).toBe(tabs[1]);
    fireEvent.keyDown(tabs[1], { key: 'ArrowDown' });
    expectSelection(2, 'Bring the source with you.');
    expect(within(screen.getByRole('tabpanel')).getByText(/2026 HVLL bylaws/)).toBeTruthy();

    fireEvent.keyDown(tabs[2], { key: 'End' });
    expectSelection(3, 'Small steps. Visible progress.');
    expect(document.activeElement).toBe(tabs[3]);
    expect(within(screen.getByRole('tabpanel')).getByText('Alex · Sample player')).toBeTruthy();
    expect(within(screen.getByRole('tabpanel')).getByText(/Practice logs track effort; coaches reassess skill improvement/)).toBeTruthy();

    fireEvent.keyDown(tabs[3], { key: 'ArrowDown' });
    expectSelection(0, 'A good week starts here.');
    fireEvent.keyDown(tabs[0], { key: 'ArrowUp' });
    expectSelection(3, 'Small steps. Visible progress.');
    fireEvent.keyDown(tabs[3], { key: 'Home' });
    expectSelection(0, 'A good week starts here.');
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('discloses coach-only evaluations and distinguishes planned video support in its FAQs', () => {
    render(<HomePage onSignIn={vi.fn()} onExploreDemo={vi.fn()} />);
    const privacyQuestion = screen.getByText('Who can see player evaluations?');
    const privacy = privacyQuestion.closest('details');
    expect(privacy.open).toBe(false);
    fireEvent.click(privacyQuestion);
    expect(privacy.open).toBe(true);
    expect(within(privacy).getByText(/Only the team’s owner and coaches/)).toBeTruthy();
    expect(within(privacy).getByText(/Player and family progress views are planned for a later release/)).toBeTruthy();

    const videoQuestion = screen.getByText('Can we stream games or get video insights?');
    const video = videoQuestion.closest('details');
    fireEvent.click(videoQuestion);
    expect(video.open).toBe(true);
    expect(within(video).getByText(/Game streaming, highlights, and coaching insights from video are planned/)).toBeTruthy();
    expect(within(video).getByText(/Today, Diamond Live supports shared schedules/)).toBeTruthy();
  });
});
