package net.runelite.cache;

import com.google.common.io.Files;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.io.File;
import java.io.IOException;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import net.runelite.cache.definitions.NpcDefinition;
import net.runelite.cache.fs.Store;
import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.CommandLineParser;
import org.apache.commons.cli.DefaultParser;
import org.apache.commons.cli.Option;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.ParseException;

public class NpcIconDumper
{
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

	static class HeadIconRef
	{
		int spriteId;
		int frame;
		String file;
	}

	static class NpcHeadIconExport
	{
		int npcId;
		String name;
		List<HeadIconRef> headIcons = new ArrayList<>();
	}

	public static void main(String[] args) throws IOException
	{
		Options options = new Options();
		options.addOption(Option.builder().longOpt("cachedir").hasArg().required().build());
		options.addOption(Option.builder().longOpt("output").hasArg().required().build());

		CommandLineParser parser = new DefaultParser();
		CommandLine cmd;
		try
		{
			cmd = parser.parse(options, args);
		}
		catch (ParseException ex)
		{
			System.err.println("Error parsing command line options: " + ex.getMessage());
			System.exit(-1);
			return;
		}

		File base = new File(cmd.getOptionValue("cachedir"));
		File outputFile = new File(cmd.getOptionValue("output"));
		File parent = outputFile.getParentFile();
		if (parent != null)
		{
			parent.mkdirs();
		}

		try (Store store = new Store(base))
		{
			store.load();

			NpcManager npcManager = new NpcManager(store);
			npcManager.load();

			List<NpcHeadIconExport> exports = new ArrayList<>();
			for (NpcDefinition npc : npcManager.getNpcs())
			{
				if (npc.headIconArchiveIds == null || npc.headIconSpriteIndex == null)
				{
					continue;
				}

				NpcHeadIconExport export = new NpcHeadIconExport();
				export.npcId = npc.getId();
				export.name = npc.getName();

				int iconCount = Math.min(npc.headIconArchiveIds.length, npc.headIconSpriteIndex.length);
				for (int i = 0; i < iconCount; ++i)
				{
					int spriteId = npc.headIconArchiveIds[i];
					int frame = npc.headIconSpriteIndex[i];
					if (spriteId < 0 || frame < 0)
					{
						continue;
					}

					HeadIconRef iconRef = new HeadIconRef();
					iconRef.spriteId = spriteId;
					iconRef.frame = frame;
					iconRef.file = spriteId + "-" + frame + ".png";
					export.headIcons.add(iconRef);
				}

				if (!export.headIcons.isEmpty())
				{
					exports.add(export);
				}
			}

			exports.sort(Comparator.comparingInt(export -> export.npcId));
			Files.asCharSink(outputFile, Charset.defaultCharset()).write(GSON.toJson(exports));
		}
	}
}