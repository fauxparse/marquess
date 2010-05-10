Marquess
========

Marquess is a [Markdown][1] editor widget for jQuery and jQuery-UI.

It uses the [Showdown][2] library to provide live previews, and
[FamFamFam's excellent Silk icon set][3] for button images,
although there's nothing to stop you swapping these out with
your own CSS. Go nuts.

Usage
-----

    $('textarea.markdown').marquess();

That's it. You can specify options by passing in a hash, but
the defaults are pretty good.

Options
-------

  - `autoUpdate`: Specify a number of milliseconds to wait after
    each `input` event before automatically updating the preview
    (to avoid stressing out the Markdown converter if you're a
    fast typist). Lower numbers mean a more responsive preview,
    but suck more CPU. Specifying `false` turns off automatic
    updates altogether.
  - `preview`: Turn the preview pane on (`true`) or off (`false`).
    This can be toggled with the button on the toolbar, so don't
    forget to hide that if you don't want a preview at all.
  - `toolbar`: Specify the layout of the editor's toolbar.
    Basically an array of arrays of command ids: check the
    source code for details.

![image title](markdown.png)

  [1]: http://daringfireball.net/projects/markdown
  [2]: http://www.attacklab.net/showdown/
  [3]: http://www.famfamfam.com/lab/icons/silk/
